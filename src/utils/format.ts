/**
 * Formatting helpers. Indian digit grouping is done by hand rather than via Intl so it renders the
 * same on every Hermes build, regardless of which ICU locales it ships.
 */

/** 1234567 → "12,34,567" */
export function formatNumber(value: number): string {
  const rounded = Math.round(value);
  const digits = Math.abs(rounded).toString();
  const lastThree = digits.slice(-3);
  const rest = digits.slice(0, -3);
  const grouped = rest ? `${rest.replace(/\B(?=(\d{2})+(?!\d))/g, ",")},${lastThree}` : lastThree;
  return rounded < 0 ? `-${grouped}` : grouped;
}

/** 1234567 → "₹12,34,567"; null/undefined → fallback. */
export function formatINR(value: number | null | undefined, fallback = "—"): string {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return value < 0 ? `-₹${formatNumber(-value)}` : `₹${formatNumber(value)}`;
}

/** 0.234 → "23%" */
export function formatPercent(ratio: number | null | undefined, fallback = "—"): string {
  if (typeof ratio !== "number" || !Number.isFinite(ratio)) return fallback;
  return `${Math.round(ratio * 100)}%`;
}

export function formatDate(epochMs: number, locale: string): string {
  const date = new Date(epochMs);
  try {
    return date.toLocaleDateString(locale, { day: "numeric", month: "short", year: "numeric" });
  } catch {
    return date.toISOString().slice(0, 10);
  }
}

export function formatTime(epochMs: number, locale: string): string {
  const date = new Date(epochMs);
  try {
    return date.toLocaleTimeString(locale, { hour: "numeric", minute: "2-digit" });
  } catch {
    return date.toISOString().slice(11, 16);
  }
}
