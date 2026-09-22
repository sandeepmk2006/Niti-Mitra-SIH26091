/**
 * @fileoverview Hyper-local data from OpenStreetMap (free, no key).
 *
 *  - Nominatim: village/block/district → coordinates, and GPS → place names.
 *  - Overpass: settlements (with population where mapped) within 5/10 km for market reach, and
 *    existing businesses of the chosen category within 5 km for competitor mapping.
 *
 * Rural India is unevenly mapped, so every figure here is "what the map knows"; the feasibility
 * prompt receives it as evidence and fills gaps with clearly-labelled estimates.
 */

import type { BusinessCategory } from "./categories";

const NOMINATIM = "https://nominatim.openstreetmap.org";
// Public Overpass instances are often overloaded; try mirrors in order.
const OVERPASS_ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
];
/** Mirrors are queried in parallel; a study never waits longer than this for map data. */
const OVERPASS_TIMEOUT_MS = 15_000;
// Nominatim's usage policy asks for an identifying User-Agent.
const HEADERS = { "User-Agent": "NitiMitra/1.0 (business advisory app)", Accept: "application/json" };

export interface Coordinates {
  lat: number;
  lon: number;
}

export interface PlaceNames {
  village: string;
  block: string;
  district: string;
  state: string;
}

export interface NearbySettlement {
  name: string;
  kind: string;
  distanceKm: number;
  population: number | null;
}

export interface LocalData {
  coordinates: Coordinates;
  /** Named villages/towns found within 10 km (closest first, max 25). */
  settlements: NearbySettlement[];
  settlementCount5km: number;
  settlementCount10km: number;
  /** Sum of mapped populations; null when the map has no population tags nearby. */
  mappedPopulation5km: number | null;
  mappedPopulation10km: number | null;
  /** Existing businesses of the chosen category within 5 km. */
  competitorCount5km: number;
  nearestCompetitorKm: number | null;
  competitorNames: string[];
}

async function fetchJson(url: string, init: RequestInit = {}, timeoutMs = 20_000): Promise<any> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...init, headers: { ...HEADERS, ...(init.headers ?? {}) }, signal: controller.signal });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } finally {
    clearTimeout(timer);
  }
}

/** Resolve with the first promise that fulfils; reject only if all reject. */
function firstSuccessful<T>(promises: Promise<T>[]): Promise<T> {
  return new Promise((resolve, reject) => {
    let failures = 0;
    promises.forEach((p) =>
      p.then(resolve, (error) => {
        failures += 1;
        if (failures === promises.length) reject(error);
      })
    );
  });
}

export function distanceKm(a: Coordinates, b: Coordinates): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLon = ((b.lon - a.lon) * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/**
 * Find coordinates for a place, trying the most specific query first and widening
 * (village → block → district) until something matches. Returns null if nothing does.
 */
export async function geocode(place: PlaceNames): Promise<Coordinates | null> {
  const parts = [place.village, place.block, place.district, place.state].map((p) => p.trim());
  const attempts = [
    parts.filter(Boolean),
    [parts[0], parts[2], parts[3]].filter(Boolean),
    [parts[1], parts[2], parts[3]].filter(Boolean),
    [parts[2], parts[3]].filter(Boolean),
  ].filter((a, i, all) => a.length > 0 && all.findIndex((b) => b.join() === a.join()) === i);

  for (const attempt of attempts) {
    const q = encodeURIComponent([...attempt, "India"].join(", "));
    try {
      const results = await fetchJson(`${NOMINATIM}/search?q=${q}&format=json&limit=1&countrycodes=in`, {}, 12_000);
      if (Array.isArray(results) && results[0]) {
        return { lat: Number(results[0].lat), lon: Number(results[0].lon) };
      }
    } catch (error) {
      console.warn("[Geo] Geocode attempt failed:", error);
    }
  }
  return null;
}

/** GPS coordinates → village/block/district/state names (best effort). */
export async function reverseGeocode(coords: Coordinates): Promise<PlaceNames | null> {
  try {
    const data = await fetchJson(
      `${NOMINATIM}/reverse?lat=${coords.lat}&lon=${coords.lon}&format=json&zoom=14&accept-language=en`,
      {},
      12_000
    );
    const a = data?.address ?? {};
    return {
      village: a.village || a.town || a.hamlet || a.suburb || a.city || "",
      block: a.subdistrict || a.county || a.municipality || "",
      district: a.state_district || a.district || a.city_district || "",
      state: a.state || "",
    };
  } catch (error) {
    console.warn("[Geo] Reverse geocode failed:", error);
    return null;
  }
}

function parsePopulation(value: unknown): number | null {
  if (typeof value !== "string") return null;
  const n = Number(value.replace(/[,\s]/g, ""));
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** Settlements within 10 km and same-category businesses within 5 km, in one Overpass query. */
export async function fetchLocalData(coords: Coordinates, category: BusinessCategory): Promise<LocalData> {
  const around5 = `(around:5000,${coords.lat},${coords.lon})`;
  const around10 = `(around:10000,${coords.lat},${coords.lon})`;
  const competitorQueries = category.osmFilters.map((f) => `nwr${f}${around5};`).join("");
  const query = `[out:json][timeout:25];
(node["place"~"^(village|town|hamlet|city|suburb)$"]${around10};)->.places;
.places out tags center;
${competitorQueries ? `(${competitorQueries})->.biz; .biz out tags center;` : ""}`;

  const data = await firstSuccessful(
    OVERPASS_ENDPOINTS.map((endpoint) =>
      fetchJson(
        endpoint,
        {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: `data=${encodeURIComponent(query)}`,
        },
        OVERPASS_TIMEOUT_MS
      )
    )
  );

  const elements: any[] = Array.isArray(data?.elements) ? data.elements : [];
  const settlements: NearbySettlement[] = [];
  const competitors: { name: string; distance: number }[] = [];
  const seen = new Set<string>();

  for (const el of elements) {
    const lat = el.lat ?? el.center?.lat;
    const lon = el.lon ?? el.center?.lon;
    if (typeof lat !== "number" || typeof lon !== "number") continue;
    const distance = distanceKm(coords, { lat, lon });
    const tags = el.tags ?? {};
    const key = `${el.type}/${el.id}`;
    if (seen.has(key)) continue;
    seen.add(key);

    if (tags.place && /^(village|town|hamlet|city|suburb)$/.test(tags.place)) {
      settlements.push({
        name: tags["name:en"] || tags.name || "",
        kind: tags.place,
        distanceKm: Math.round(distance * 10) / 10,
        population: parsePopulation(tags.population),
      });
    } else if (distance <= 5.05) {
      competitors.push({ name: tags.name || "", distance });
    }
  }

  settlements.sort((a, b) => a.distanceKm - b.distanceKm);
  competitors.sort((a, b) => a.distance - b.distance);

  const within = (km: number) => settlements.filter((s) => s.distanceKm <= km);
  const population = (list: NearbySettlement[]) => {
    const known = list.filter((s) => s.population !== null);
    return known.length ? known.reduce((sum, s) => sum + (s.population ?? 0), 0) : null;
  };

  return {
    coordinates: coords,
    settlements: settlements.filter((s) => s.name).slice(0, 25),
    settlementCount5km: within(5).length,
    settlementCount10km: settlements.length,
    mappedPopulation5km: population(within(5)),
    mappedPopulation10km: population(settlements),
    competitorCount5km: competitors.length,
    nearestCompetitorKm: competitors.length ? Math.round(competitors[0].distance * 10) / 10 : null,
    competitorNames: competitors.map((c) => c.name).filter(Boolean).slice(0, 8),
  };
}
