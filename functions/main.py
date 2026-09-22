"""
Firebase Gen 2 Cloud Functions — SIH26091
AI-Driven Hyper-Local Business Advisory & Financial Structuring Assistant

main.py — HTTPS Callable function with LangGraph multi-agent pipeline.

Agents:
    1. orchestrator_node:       Normalizes raw business inputs into structured dimensions.
    2. hyperlocal_scraper_node: Queries Google Places / OSM Overpass for competitor density.
    3. financial_agent_node:    Calculates DSCR, BEP, Working Capital; matches govt schemes.
    4. validator_node:          Validates metrics against risk thresholds.

Runtime: Python 3.11 | Memory: 2 GB | Timeout: 120s | Region: asia-south1
"""

from __future__ import annotations

import json
import math
import os
import uuid
from datetime import datetime, timezone
from typing import Any, TypedDict, Annotated

import requests
from firebase_admin import initialize_app, firestore
from firebase_functions import https_fn, options
from google.cloud.firestore import SERVER_TIMESTAMP

# LangGraph imports
from langgraph.graph import StateGraph, START, END

# LangChain imports (for LLM-powered nodes)
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.messages import HumanMessage, SystemMessage

# ──────────────────────────────────────────────────────────────
# Firebase Admin Initialization
# ──────────────────────────────────────────────────────────────

initialize_app()

# ──────────────────────────────────────────────────────────────
# Configuration
# ──────────────────────────────────────────────────────────────

# Google Places API key (set via Firebase environment config)
GOOGLE_PLACES_API_KEY = os.environ.get("GOOGLE_PLACES_API_KEY", "")

# Gemini API key for server-side LLM reasoning
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "")

# Pipeline version identifier
MODEL_VERSION = "v1.0.0-langgraph"

# Search radius for competitor analysis (meters)
DEFAULT_SEARCH_RADIUS_M = 2000

# ──────────────────────────────────────────────────────────────
# LangGraph State Definition
# ──────────────────────────────────────────────────────────────


class PipelineState(TypedDict):
    """
    Shared state for the LangGraph multi-agent pipeline.

    Each node reads from and writes to this state dict.
    The state flows through: orchestrator → scraper → financial → validator.
    """

    # ── Input (from client) ──
    raw_transcript: str
    source_language: str
    parsed_on_device: bool
    client_parsed_context: dict | None
    user_id: str
    social_category: str
    trade_type: str
    annual_family_income: float

    # ── Orchestrator Output ──
    parsed_input: dict

    # ── Hyperlocal Scraper Output ──
    market: dict

    # ── Financial Agent Output ──
    financial: dict
    schemes: list[dict]

    # ── Validator Output ──
    risk: dict

    # ── Pipeline Metadata ──
    status: str
    error_message: str
    idea_id: str


# ──────────────────────────────────────────────────────────────
# LLM Initialization (Lazy)
# ──────────────────────────────────────────────────────────────


def get_llm() -> ChatGoogleGenerativeAI:
    """
    Get a configured Gemini LLM instance for server-side reasoning.

    Used by the orchestrator (raw text normalization) and validator
    (risk narrative generation). The financial agent uses pure Python
    calculations — no LLM needed.

    Returns:
        ChatGoogleGenerativeAI: Configured Gemini model instance.
    """
    return ChatGoogleGenerativeAI(
        model="gemini-2.0-flash",
        google_api_key=GEMINI_API_KEY,
        temperature=0.1,
        max_output_tokens=1024,
    )


# ──────────────────────────────────────────────────────────────
# NODE 1: Orchestrator — Context Normalization
# ──────────────────────────────────────────────────────────────

ORCHESTRATOR_SYSTEM_PROMPT = """You are a business input normalizer for rural Indian micro-entrepreneurs.
Given a raw business description (potentially in Hindi or other Indian languages), extract structured business dimensions.

Return ONLY a valid JSON object with these fields (use null for unknown values):
{
    "category": "business type (e.g., food_stall, tailoring, pottery, grocery, carpentry)",
    "sub_category": "specific sub-type or null",
    "location_lat": number or null,
    "location_lng": number or null,
    "location_description": "location mentioned or null",
    "monthly_revenue": number in INR or null,
    "monthly_costs": number in INR or null,
    "monthly_fixed_costs": number in INR or null,
    "price_per_unit": number in INR or null,
    "variable_cost_per_unit": number in INR or null,
    "existing_monthly_debt": number in INR or null,
    "existing_loan_principal": number in INR or null
}

Important:
- Convert any mentioned amounts to INR numbers (e.g., "10 thousand" → 10000).
- If the user mentions a location by name, include it in location_description.
- Do not fabricate data. Use null for anything not mentioned.
- Output ONLY the JSON object, no explanation."""


def orchestrator_node(state: PipelineState) -> dict:
    """
    Orchestrator Node — Normalizes raw business inputs into structured dimensions.

    If the client already parsed the input on-device (Gemma-2B), this node
    validates and passes through the parsed context. Otherwise, it uses the
    server-side Gemini LLM to extract structured dimensions from raw text.

    Args:
        state: Current pipeline state.

    Returns:
        Dict with 'parsed_input' key containing structured business dimensions.
    """
    print("[Orchestrator] Starting context normalization...")

    # If client already parsed on-device, validate and use that
    if state.get("parsed_on_device") and state.get("client_parsed_context"):
        client_ctx = state["client_parsed_context"]
        print("[Orchestrator] Using client-parsed context from on-device Gemma-2B")

        # Normalize field names from camelCase (client) to snake_case (server)
        parsed = {
            "category": client_ctx.get("category", "unknown"),
            "sub_category": client_ctx.get("subCategory"),
            "location_lat": client_ctx.get("locationLat"),
            "location_lng": client_ctx.get("locationLng"),
            "location_description": client_ctx.get("locationDescription"),
            "monthly_revenue": client_ctx.get("monthlyRevenue"),
            "monthly_costs": client_ctx.get("monthlyCosts"),
            "monthly_fixed_costs": client_ctx.get("monthlyFixedCosts"),
            "price_per_unit": client_ctx.get("pricePerUnit"),
            "variable_cost_per_unit": client_ctx.get("variableCostPerUnit"),
            "existing_monthly_debt": client_ctx.get("existingMonthlyDebt"),
            "existing_loan_principal": client_ctx.get("existingLoanPrincipal"),
        }

        return {"parsed_input": parsed}

    # Otherwise, use Gemini to parse the raw transcript
    raw_transcript = state.get("raw_transcript", "")

    if not raw_transcript.strip():
        print("[Orchestrator] Empty transcript — using defaults")
        return {
            "parsed_input": {
                "category": "unknown",
                "sub_category": None,
                "location_lat": None,
                "location_lng": None,
                "location_description": None,
                "monthly_revenue": None,
                "monthly_costs": None,
                "monthly_fixed_costs": None,
                "price_per_unit": None,
                "variable_cost_per_unit": None,
                "existing_monthly_debt": None,
                "existing_loan_principal": None,
            }
        }

    try:
        llm = get_llm()
        messages = [
            SystemMessage(content=ORCHESTRATOR_SYSTEM_PROMPT),
            HumanMessage(content=f"User Input: \"{raw_transcript}\""),
        ]

        response = llm.invoke(messages)
        response_text = response.content.strip()

        # Extract JSON from the response
        parsed = _extract_json(response_text)

        if parsed:
            print(f"[Orchestrator] Parsed {len([v for v in parsed.values() if v is not None])} fields from transcript")
            return {"parsed_input": parsed}
        else:
            print("[Orchestrator] LLM returned non-JSON response, using defaults")
            return {
                "parsed_input": {
                    "category": "unknown",
                    "sub_category": None,
                    "location_description": raw_transcript[:200],
                    "monthly_revenue": None,
                    "monthly_costs": None,
                    "monthly_fixed_costs": None,
                    "price_per_unit": None,
                    "variable_cost_per_unit": None,
                    "existing_monthly_debt": None,
                    "existing_loan_principal": None,
                    "location_lat": None,
                    "location_lng": None,
                }
            }

    except Exception as e:
        print(f"[Orchestrator] LLM parsing failed: {e}")
        return {
            "parsed_input": {
                "category": "unknown",
                "sub_category": None,
                "location_description": state.get("raw_transcript", "")[:200],
                "monthly_revenue": None,
                "monthly_costs": None,
                "monthly_fixed_costs": None,
                "price_per_unit": None,
                "variable_cost_per_unit": None,
                "existing_monthly_debt": None,
                "existing_loan_principal": None,
                "location_lat": None,
                "location_lng": None,
            }
        }


# ──────────────────────────────────────────────────────────────
# NODE 2: Hyperlocal Scraper — Spatial Market Analysis
# ──────────────────────────────────────────────────────────────


def hyperlocal_scraper_node(state: PipelineState) -> dict:
    """
    Hyperlocal Scraper Node — Queries nearby competitor businesses.

    Strategy:
    1. Primary: Google Places API Nearby Search within 2km radius.
    2. Fallback: OpenStreetMap Overpass API if Places quota exceeded.
    3. Final fallback: Return zero-competitor result with a flag.

    Calculates:
    - competitor_density: competitors per km²
    - nearest_competitor_m: distance to nearest competitor (meters)
    - competitor_names: list of nearby business names

    Args:
        state: Current pipeline state with parsed_input.

    Returns:
        Dict with 'market' key containing market analysis results.
    """
    print("[HyperlocalScraper] Starting spatial market analysis...")

    parsed = state.get("parsed_input", {})
    lat = parsed.get("location_lat")
    lng = parsed.get("location_lng")
    category = parsed.get("category", "business")

    # Default market result (used when no location data available)
    default_market = {
        "competitor_density": 0.0,
        "nearest_competitor_m": 0,
        "competitor_names": [],
        "total_competitors": 0,
        "search_radius_m": DEFAULT_SEARCH_RADIUS_M,
    }

    if lat is None or lng is None:
        print("[HyperlocalScraper] No coordinates — skipping spatial analysis")
        return {"market": default_market}

    # Map business categories to Google Places types
    category_to_places_type = {
        "food_stall": "restaurant",
        "restaurant": "restaurant",
        "grocery": "grocery_or_supermarket",
        "tailoring": "clothing_store",
        "pottery": "store",
        "carpentry": "furniture_store",
        "blacksmith": "hardware_store",
        "salon": "beauty_salon",
        "barber": "hair_care",
        "pharmacy": "pharmacy",
        "electronics": "electronics_store",
    }

    places_type = category_to_places_type.get(category, "store")

    # ── Strategy 1: Google Places API ──
    if GOOGLE_PLACES_API_KEY:
        try:
            market = _query_google_places(lat, lng, places_type, category)
            if market:
                print(f"[HyperlocalScraper] Google Places found {market['total_competitors']} competitors")
                return {"market": market}
        except Exception as e:
            print(f"[HyperlocalScraper] Google Places API failed: {e}")

    # ── Strategy 2: OpenStreetMap Overpass API (free, no key needed) ──
    try:
        market = _query_osm_overpass(lat, lng, category)
        if market:
            print(f"[HyperlocalScraper] OSM Overpass found {market['total_competitors']} competitors")
            return {"market": market}
    except Exception as e:
        print(f"[HyperlocalScraper] OSM Overpass API failed: {e}")

    # ── Final fallback ──
    print("[HyperlocalScraper] All APIs failed — returning zero-competitor result")
    return {"market": default_market}


def _query_google_places(
    lat: float, lng: float, places_type: str, keyword: str
) -> dict | None:
    """
    Query Google Places API Nearby Search.

    Args:
        lat: Latitude of the search center.
        lng: Longitude of the search center.
        places_type: Google Places type filter.
        keyword: Business category keyword.

    Returns:
        Market analysis dict, or None on failure.
    """
    url = "https://maps.googleapis.com/maps/api/place/nearbysearch/json"
    params = {
        "location": f"{lat},{lng}",
        "radius": DEFAULT_SEARCH_RADIUS_M,
        "type": places_type,
        "keyword": keyword,
        "key": GOOGLE_PLACES_API_KEY,
    }

    response = requests.get(url, params=params, timeout=10)
    response.raise_for_status()
    data = response.json()

    if data.get("status") not in ("OK", "ZERO_RESULTS"):
        print(f"[GooglePlaces] API status: {data.get('status')}")
        return None

    results = data.get("results", [])
    total = len(results)

    # Calculate density (competitors per km²)
    area_km2 = math.pi * (DEFAULT_SEARCH_RADIUS_M / 1000) ** 2
    density = total / area_km2 if area_km2 > 0 else 0.0

    # Find nearest competitor
    nearest_m = 0
    names: list[str] = []

    for place in results[:20]:  # Cap at 20 for response size
        names.append(place.get("name", "Unknown"))
        place_lat = place.get("geometry", {}).get("location", {}).get("lat", 0)
        place_lng = place.get("geometry", {}).get("location", {}).get("lng", 0)
        dist = _haversine_distance(lat, lng, place_lat, place_lng)

        if nearest_m == 0 or dist < nearest_m:
            nearest_m = dist

    return {
        "competitor_density": round(density, 2),
        "nearest_competitor_m": round(nearest_m),
        "competitor_names": names,
        "total_competitors": total,
        "search_radius_m": DEFAULT_SEARCH_RADIUS_M,
    }


def _query_osm_overpass(lat: float, lng: float, category: str) -> dict | None:
    """
    Query OpenStreetMap Overpass API for nearby businesses.

    Uses a bounding box query with OSM tags relevant to the business category.

    Args:
        lat: Latitude of the search center.
        lng: Longitude of the search center.
        category: Business category for tag matching.

    Returns:
        Market analysis dict, or None on failure.
    """
    # Map categories to OSM tags
    category_to_osm = {
        "food_stall": '"amenity"="restaurant"',
        "restaurant": '"amenity"="restaurant"',
        "grocery": '"shop"="supermarket"',
        "tailoring": '"shop"="clothes"',
        "pottery": '"shop"="craft"',
        "carpentry": '"shop"="furniture"',
        "blacksmith": '"shop"="hardware"',
        "salon": '"shop"="beauty"',
        "barber": '"shop"="hairdresser"',
    }

    osm_tag = category_to_osm.get(category, '"shop"="yes"')

    # Convert radius to approximate bounding box
    delta = DEFAULT_SEARCH_RADIUS_M / 111000  # Rough degree offset
    bbox = f"{lat - delta},{lng - delta},{lat + delta},{lng + delta}"

    query = f"""
    [out:json][timeout:10];
    (
      node[{osm_tag}]({bbox});
      way[{osm_tag}]({bbox});
    );
    out center;
    """

    response = requests.post(
        "https://overpass-api.de/api/interpreter",
        data={"data": query},
        timeout=15,
    )
    response.raise_for_status()
    data = response.json()

    elements = data.get("elements", [])
    total = len(elements)

    area_km2 = math.pi * (DEFAULT_SEARCH_RADIUS_M / 1000) ** 2
    density = total / area_km2 if area_km2 > 0 else 0.0

    nearest_m = 0
    names: list[str] = []

    for el in elements[:20]:
        name = el.get("tags", {}).get("name", "Unknown")
        names.append(name)

        el_lat = el.get("lat") or el.get("center", {}).get("lat", 0)
        el_lng = el.get("lon") or el.get("center", {}).get("lon", 0)

        if el_lat and el_lng:
            dist = _haversine_distance(lat, lng, el_lat, el_lng)
            if nearest_m == 0 or dist < nearest_m:
                nearest_m = dist

    return {
        "competitor_density": round(density, 2),
        "nearest_competitor_m": round(nearest_m),
        "competitor_names": names,
        "total_competitors": total,
        "search_radius_m": DEFAULT_SEARCH_RADIUS_M,
    }


def _haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """
    Calculate the Haversine distance between two lat/lng points.

    Args:
        lat1, lon1: First point coordinates (degrees).
        lat2, lon2: Second point coordinates (degrees).

    Returns:
        Distance in meters.
    """
    R = 6371000  # Earth radius in meters

    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)

    a = (
        math.sin(dphi / 2) ** 2
        + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2) ** 2
    )
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))

    return R * c


# ──────────────────────────────────────────────────────────────
# NODE 3: Financial Agent — DSCR, BEP, Scheme Matching
# ──────────────────────────────────────────────────────────────

# ── Government Scheme Definitions ──

PM_VISHWAKARMA_TRADES = {
    "carpenter", "boat_maker", "armourer", "blacksmith",
    "hammer_and_toolkit_maker", "locksmith", "goldsmith", "potter",
    "sculptor", "cobbler", "mason", "basket_weaver",
    "doll_and_toy_maker", "barber", "garland_maker", "washerman",
    "tailor", "fishing_net_maker",
}


def financial_agent_node(state: PipelineState) -> dict:
    """
    Financial Agent Node — Pure Python financial calculations & scheme matching.

    Calculations:
    - DSCR (Debt Service Coverage Ratio) = Net Operating Income / Total Debt Service
    - BEP (Break-Even Point) in units and revenue
    - Working Capital = Current Assets - Current Liabilities
    - Monthly Net Income projection

    Scheme Matching:
    - PM-Vishwakarma: 18 trades, no income limit, loan up to ₹3 lakh
    - PM-DAKSH: SC/OBC/EWS, skill training, income < ₹3L for OBC/EWS
    - NSFDC: SC only, income < ₹5L, concessional loans

    Args:
        state: Current pipeline state with parsed_input.

    Returns:
        Dict with 'financial' and 'schemes' keys.
    """
    print("[FinancialAgent] Calculating financial metrics...")

    parsed = state.get("parsed_input", {})

    # ── Extract financial inputs (default to 0 if missing) ──
    monthly_revenue = _safe_float(parsed.get("monthly_revenue"), 0.0)
    monthly_costs = _safe_float(parsed.get("monthly_costs"), 0.0)
    monthly_fixed_costs = _safe_float(parsed.get("monthly_fixed_costs"), 0.0)
    price_per_unit = _safe_float(parsed.get("price_per_unit"), 0.0)
    variable_cost_per_unit = _safe_float(parsed.get("variable_cost_per_unit"), 0.0)
    existing_monthly_debt = _safe_float(parsed.get("existing_monthly_debt"), 0.0)
    existing_loan_principal = _safe_float(parsed.get("existing_loan_principal"), 0.0)

    # ── Derived metrics ──

    # Net Operating Income (monthly)
    net_operating_income = monthly_revenue - monthly_costs

    # Monthly Net Income (after debt service)
    monthly_net_income = net_operating_income - existing_monthly_debt

    # DSCR: Net Operating Income / Total Debt Service
    # If no debt, DSCR is effectively infinite (cap at 99.0 for display)
    if existing_monthly_debt > 0:
        dscr = round(net_operating_income / existing_monthly_debt, 2)
    else:
        dscr = 99.0 if net_operating_income > 0 else 0.0

    # Contribution Margin Ratio
    if price_per_unit > 0:
        contribution_margin_ratio = round(
            (price_per_unit - variable_cost_per_unit) / price_per_unit, 4
        )
    elif monthly_revenue > 0 and monthly_costs > 0:
        # Estimate from aggregate numbers
        variable_costs_estimate = monthly_costs - monthly_fixed_costs
        contribution_margin_ratio = round(
            (monthly_revenue - variable_costs_estimate) / monthly_revenue, 4
        )
    else:
        contribution_margin_ratio = 0.0

    # Break-Even Point (Units)
    if price_per_unit > 0 and variable_cost_per_unit < price_per_unit:
        bep_units = round(
            monthly_fixed_costs / (price_per_unit - variable_cost_per_unit), 1
        )
    else:
        bep_units = 0.0

    # Break-Even Point (Revenue)
    if contribution_margin_ratio > 0:
        bep_revenue = round(monthly_fixed_costs / contribution_margin_ratio, 2)
    else:
        bep_revenue = 0.0

    # Working Capital (simplified: 2 months revenue - 1 month costs - debt)
    current_assets_estimate = monthly_revenue * 2
    current_liabilities_estimate = monthly_costs + existing_monthly_debt
    working_capital = round(current_assets_estimate - current_liabilities_estimate, 2)

    financial = {
        "dscr": dscr,
        "bep_units": bep_units,
        "bep_revenue": bep_revenue,
        "working_capital": working_capital,
        "monthly_net_income": round(monthly_net_income, 2),
        "contribution_margin_ratio": contribution_margin_ratio,
    }

    print(f"[FinancialAgent] DSCR={dscr}, BEP₹={bep_revenue}, WorkCap={working_capital}")

    # ── Scheme Matching ──
    schemes = _match_government_schemes(state)

    print(f"[FinancialAgent] Matched {len([s for s in schemes if s['eligible']])} eligible schemes")

    return {"financial": financial, "schemes": schemes}


def _match_government_schemes(state: PipelineState) -> list[dict]:
    """
    Match user profile against government schemes.

    Eligibility Rules:
    - PM-Vishwakarma: Must be in one of 18 trades, no income limit.
    - PM-DAKSH: SC/OBC/EWS aged 18-45; OBC/EWS need income < ₹3L.
    - NSFDC: SC only, family income < ₹5L.

    Args:
        state: Pipeline state with user profile data.

    Returns:
        List of scheme recommendation dicts.
    """
    trade_type = state.get("trade_type", "").lower().strip()
    social_category = state.get("social_category", "").upper().strip()
    annual_income = _safe_float(state.get("annual_family_income"), 0.0)

    schemes: list[dict] = []

    # ── PM-Vishwakarma ──
    vishwakarma_eligible = trade_type in PM_VISHWAKARMA_TRADES
    schemes.append({
        "scheme_name": "PM-Vishwakarma",
        "eligible": vishwakarma_eligible,
        "eligibility_reason": (
            f"Trade '{trade_type}' is recognized under PM-Vishwakarma"
            if vishwakarma_eligible
            else f"Trade '{trade_type}' is not among the 18 recognized PM-Vishwakarma trades"
        ),
        "max_amount": 300000 if vishwakarma_eligible else None,  # ₹3 lakh
        "interest_rate": "5% (subsidized to 8% by GoI)",
        "portal_url": "https://pmvishwakarma.gov.in",
    })

    # ── PM-DAKSH ──
    daksh_eligible_categories = {"SC", "OBC", "EWS", "ST"}
    in_target_group = social_category in daksh_eligible_categories

    # OBC/EWS need income < ₹3L; SC/ST have no income limit
    if in_target_group:
        if social_category in ("OBC", "EWS"):
            daksh_eligible = annual_income > 0 and annual_income < 300000
            reason = (
                f"Category {social_category} with income ₹{annual_income:,.0f} "
                f"({'within' if daksh_eligible else 'exceeds'} ₹3L limit for {social_category})"
            )
        else:
            daksh_eligible = True
            reason = f"Category {social_category} — no income limit applies"
    else:
        daksh_eligible = False
        reason = f"Category '{social_category}' is not in PM-DAKSH target groups (SC/ST/OBC/EWS)"

    schemes.append({
        "scheme_name": "PM-DAKSH",
        "eligible": daksh_eligible,
        "eligibility_reason": reason,
        "max_amount": None,  # Skill training — no direct loan
        "interest_rate": "N/A (skill training program)",
        "portal_url": "https://pmdaksh.dosje.gov.in",
    })

    # ── NSFDC ──
    nsfdc_eligible = social_category == "SC" and (
        annual_income == 0 or annual_income <= 500000
    )
    nsfdc_reason = ""
    if social_category != "SC":
        nsfdc_reason = f"NSFDC is exclusively for SC community (your category: {social_category})"
    elif annual_income > 500000:
        nsfdc_reason = f"Annual family income ₹{annual_income:,.0f} exceeds ₹5L NSFDC ceiling"
    else:
        nsfdc_reason = f"SC category with income ₹{annual_income:,.0f} (within ₹5L ceiling)"

    schemes.append({
        "scheme_name": "NSFDC",
        "eligible": nsfdc_eligible,
        "eligibility_reason": nsfdc_reason,
        "max_amount": 1500000 if nsfdc_eligible else None,  # Up to ₹15L for micro-credit
        "interest_rate": "Concessional (varies by State Channelizing Agency)",
        "portal_url": "https://nsfdc.nic.in",
    })

    return schemes


# ──────────────────────────────────────────────────────────────
# NODE 4: Validator — Risk Assessment & Sanity Checks
# ──────────────────────────────────────────────────────────────

VALIDATOR_SYSTEM_PROMPT = """You are a rural business risk advisor for India. Given the financial metrics and market data below, write a concise 2-3 sentence risk assessment narrative in simple language.

Focus on:
1. Whether the business can service its debts (DSCR)
2. How long until break-even
3. Market competition level
4. Any red flags

Keep the language simple and encouraging — the audience is a rural micro-entrepreneur."""


def validator_node(state: PipelineState) -> dict:
    """
    Validator Node — Validates financial metrics against risk thresholds.

    Risk Classification:
    - DSCR < 1.0  → HIGH_RISK (cannot service debt from operating income)
    - DSCR 1.0-1.25 → MODERATE_RISK (thin margin for debt service)
    - DSCR > 1.25   → LOW_RISK (healthy debt coverage)

    Additional Flags:
    - Unrealistic margins (> 80%)
    - Negative working capital
    - BEP exceeding 36-month revenue horizon
    - Zero revenue input

    Args:
        state: Pipeline state with financial metrics and market data.

    Returns:
        Dict with 'risk' and 'status' keys.
    """
    print("[Validator] Running risk assessment...")

    financial = state.get("financial", {})
    market = state.get("market", {})
    parsed = state.get("parsed_input", {})

    dscr = financial.get("dscr", 0.0)
    bep_revenue = financial.get("bep_revenue", 0.0)
    working_capital = financial.get("working_capital", 0.0)
    monthly_revenue = _safe_float(parsed.get("monthly_revenue"), 0.0)
    monthly_costs = _safe_float(parsed.get("monthly_costs"), 0.0)
    monthly_net_income = financial.get("monthly_net_income", 0.0)

    # ── Risk Level Classification ──
    if dscr < 1.0:
        risk_level = "HIGH_RISK"
    elif dscr <= 1.25:
        risk_level = "MODERATE_RISK"
    else:
        risk_level = "LOW_RISK"

    # ── Risk Flags ──
    flags: list[str] = []

    if dscr < 1.0 and dscr != 0.0:
        flags.append(f"DSCR is {dscr} — operating income insufficient to cover debt obligations")

    if monthly_revenue > 0 and monthly_costs > 0:
        margin = (monthly_revenue - monthly_costs) / monthly_revenue
        if margin > 0.80:
            flags.append(f"Profit margin of {margin:.0%} seems unrealistically high — verify cost estimates")

    if working_capital < 0:
        flags.append(f"Negative working capital (₹{working_capital:,.0f}) — liquidity risk")

    if bep_revenue > 0 and monthly_revenue > 0:
        months_to_bep = bep_revenue / monthly_revenue
        if months_to_bep > 36:
            flags.append(f"Break-even requires {months_to_bep:.0f} months of revenue — exceeds 3-year horizon")

    if monthly_revenue == 0:
        flags.append("No revenue estimate provided — financial projections are placeholder only")

    competitor_density = market.get("competitor_density", 0.0)
    if competitor_density > 10:
        flags.append(f"High competitor density ({competitor_density}/km²) — market may be saturated")

    # If no meaningful financial data, mark as PARTIAL
    status = "SUCCESS"
    if monthly_revenue == 0 and monthly_costs == 0:
        status = "PARTIAL"
        flags.append("Insufficient financial data — results are indicative only")

    # ── LLM-generated Risk Narrative ──
    narrative = _generate_risk_narrative(financial, market, risk_level, flags)

    risk = {
        "level": risk_level,
        "flags": flags,
        "narrative": narrative,
    }

    print(f"[Validator] Risk level: {risk_level}, Flags: {len(flags)}")

    return {"risk": risk, "status": status}


def _generate_risk_narrative(
    financial: dict,
    market: dict,
    risk_level: str,
    flags: list[str],
) -> str:
    """
    Generate a natural-language risk narrative using the Gemini LLM.

    Falls back to a template-based narrative if the LLM call fails.

    Args:
        financial: Financial metrics dict.
        market: Market analysis dict.
        risk_level: Classified risk level string.
        flags: List of risk flag strings.

    Returns:
        Risk narrative string.
    """
    try:
        llm = get_llm()

        context = (
            f"DSCR: {financial.get('dscr', 'N/A')}\n"
            f"Break-Even Revenue: ₹{financial.get('bep_revenue', 0):,.0f}\n"
            f"Working Capital: ₹{financial.get('working_capital', 0):,.0f}\n"
            f"Monthly Net Income: ₹{financial.get('monthly_net_income', 0):,.0f}\n"
            f"Competitor Density: {market.get('competitor_density', 0)}/km²\n"
            f"Nearest Competitor: {market.get('nearest_competitor_m', 0)}m\n"
            f"Risk Level: {risk_level}\n"
            f"Flags: {', '.join(flags) if flags else 'None'}"
        )

        messages = [
            SystemMessage(content=VALIDATOR_SYSTEM_PROMPT),
            HumanMessage(content=context),
        ]

        response = llm.invoke(messages)
        return response.content.strip()

    except Exception as e:
        print(f"[Validator] LLM narrative generation failed: {e}")
        # Fallback template-based narrative
        if risk_level == "HIGH_RISK":
            return (
                "This business idea carries significant financial risk. "
                "The current projections suggest the operating income may not be "
                "sufficient to cover debt obligations. Consider reducing costs or "
                "exploring government scheme support before proceeding."
            )
        elif risk_level == "MODERATE_RISK":
            return (
                "This business idea shows moderate promise but has thin margins. "
                "Careful cost management and leveraging government schemes could "
                "improve viability. Consider starting small and scaling gradually."
            )
        else:
            return (
                "This business idea shows good financial viability with healthy "
                "margins and manageable risk. The market conditions appear favorable. "
                "Consider applying for relevant government schemes to maximize support."
            )


# ──────────────────────────────────────────────────────────────
# Utility Functions
# ──────────────────────────────────────────────────────────────


def _safe_float(value: Any, default: float = 0.0) -> float:
    """Safely convert a value to float, returning default on failure."""
    if value is None:
        return default
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def _extract_json(text: str) -> dict | None:
    """
    Extract a JSON object from a text response.
    Handles raw JSON, markdown code blocks, and embedded JSON patterns.

    Args:
        text: Raw text that may contain JSON.

    Returns:
        Parsed dict, or None if no valid JSON found.
    """
    # Try direct parse
    try:
        return json.loads(text.strip())
    except json.JSONDecodeError:
        pass

    # Try markdown code block
    import re

    code_block = re.search(r"```(?:json)?\s*([\s\S]*?)```", text)
    if code_block:
        try:
            return json.loads(code_block.group(1).strip())
        except json.JSONDecodeError:
            pass

    # Try any JSON object pattern
    json_match = re.search(r"\{[\s\S]*\}", text)
    if json_match:
        try:
            return json.loads(json_match.group(0))
        except json.JSONDecodeError:
            pass

    return None


# ──────────────────────────────────────────────────────────────
# LangGraph Pipeline Assembly
# ──────────────────────────────────────────────────────────────


def build_evaluation_graph() -> StateGraph:
    """
    Build and compile the LangGraph multi-agent evaluation pipeline.

    Graph topology (linear):
        START → orchestrator → hyperlocal_scraper → financial_agent → validator → END

    Returns:
        Compiled LangGraph StateGraph ready for invocation.
    """
    graph = StateGraph(PipelineState)

    # Add nodes
    graph.add_node("orchestrator", orchestrator_node)
    graph.add_node("hyperlocal_scraper", hyperlocal_scraper_node)
    graph.add_node("financial_agent", financial_agent_node)
    graph.add_node("validator", validator_node)

    # Define edges (linear pipeline)
    graph.add_edge(START, "orchestrator")
    graph.add_edge("orchestrator", "hyperlocal_scraper")
    graph.add_edge("hyperlocal_scraper", "financial_agent")
    graph.add_edge("financial_agent", "validator")
    graph.add_edge("validator", END)

    return graph.compile()


# Pre-compile the graph at module load time (reused across invocations)
evaluation_pipeline = build_evaluation_graph()


# ──────────────────────────────────────────────────────────────
# Firebase HTTPS Callable — Entry Point
# ──────────────────────────────────────────────────────────────


@https_fn.on_call(
    memory=options.MemoryOption.GB_2,
    timeout_sec=120,
    region="asia-south1",
)
def evaluate_business_idea(req: https_fn.CallableRequest) -> dict:
    """
    Firebase HTTPS Callable — Evaluate a business idea.

    This is the main entry point called by the Expo React Native client.
    It runs the full LangGraph multi-agent pipeline and saves results to Firestore.

    Request Payload (req.data):
        rawTranscript (str):       Original user text/transcript.
        sourceLanguage (str):      ISO-639 language code.
        parsedContext (dict|null): Structured context from on-device parsing.
        parsedOnDevice (bool):     Whether on-device Gemma-2B was used.
        userId (str, optional):    Firebase Auth user ID.
        socialCategory (str):      SC/ST/OBC/EWS/GENERAL.
        tradeType (str):           PM-Vishwakarma trade type.
        annualFamilyIncome (float): Annual family income in INR.

    Returns:
        dict: Complete evaluation result with financial metrics, market analysis,
              scheme recommendations, and risk assessment.

    Raises:
        https_fn.HttpsError: On invalid arguments or internal errors.
    """
    print("=" * 60)
    print("[evaluate_business_idea] Invocation started")
    print("=" * 60)

    # ── Validate request ──
    data = req.data

    if not data:
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.INVALID_ARGUMENT,
            message="Request data is required.",
        )

    raw_transcript = data.get("rawTranscript", "")
    if not raw_transcript and not data.get("parsedContext"):
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.INVALID_ARGUMENT,
            message="Either 'rawTranscript' or 'parsedContext' must be provided.",
        )

    # ── Resolve user ID ──
    user_id = data.get("userId", "")
    if req.auth and req.auth.uid:
        user_id = req.auth.uid  # Prefer authenticated UID

    if not user_id:
        user_id = f"anonymous_{uuid.uuid4().hex[:12]}"

    idea_id = uuid.uuid4().hex

    # ── Build initial pipeline state ──
    initial_state: PipelineState = {
        "raw_transcript": raw_transcript,
        "source_language": data.get("sourceLanguage", "en"),
        "parsed_on_device": data.get("parsedOnDevice", False),
        "client_parsed_context": data.get("parsedContext"),
        "user_id": user_id,
        "social_category": data.get("socialCategory", "GENERAL"),
        "trade_type": data.get("tradeType", ""),
        "annual_family_income": _safe_float(data.get("annualFamilyIncome"), 0.0),
        # These will be populated by the pipeline nodes
        "parsed_input": {},
        "market": {},
        "financial": {},
        "schemes": [],
        "risk": {},
        "status": "SUCCESS",
        "error_message": "",
        "idea_id": idea_id,
    }

    # ── Run the LangGraph pipeline ──
    try:
        print("[evaluate_business_idea] Running LangGraph pipeline...")
        final_state = evaluation_pipeline.invoke(initial_state)
        print("[evaluate_business_idea] Pipeline completed successfully")
    except Exception as e:
        print(f"[evaluate_business_idea] Pipeline failed: {e}")
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.INTERNAL,
            message=f"Evaluation pipeline failed: {str(e)}",
        )

    # ── Prepare response ──
    response = {
        "status": final_state.get("status", "SUCCESS"),
        "ideaId": idea_id,
        "parsedInput": _snake_to_camel_dict(final_state.get("parsed_input", {})),
        "market": _snake_to_camel_dict(final_state.get("market", {})),
        "financial": _snake_to_camel_dict(final_state.get("financial", {})),
        "schemes": [
            _snake_to_camel_dict(s) for s in final_state.get("schemes", [])
        ],
        "risk": _snake_to_camel_dict(final_state.get("risk", {})),
        "evaluatedAt": datetime.now(timezone.utc).isoformat(),
        "modelVersion": MODEL_VERSION,
    }

    # ── Save to Firestore ──
    try:
        _save_to_firestore(user_id, idea_id, final_state)
        print(f"[evaluate_business_idea] Saved to Firestore: /users/{user_id}/ideas/{idea_id}")
    except Exception as e:
        print(f"[evaluate_business_idea] Firestore save failed: {e}")
        response["status"] = "PARTIAL"
        response["errorMessage"] = f"Evaluation succeeded but failed to save: {str(e)}"

    print("=" * 60)
    print(f"[evaluate_business_idea] Returning result — status: {response['status']}")
    print("=" * 60)

    return response


# ──────────────────────────────────────────────────────────────
# Firestore Persistence
# ──────────────────────────────────────────────────────────────


def _save_to_firestore(user_id: str, idea_id: str, state: PipelineState) -> None:
    """
    Save the complete evaluation result to Firestore.

    Document path: /users/{userId}/ideas/{ideaId}

    Also creates the user document if it doesn't exist (upsert with merge).

    Args:
        user_id: Firebase Auth user ID or anonymous ID.
        idea_id: Unique evaluation ID.
        state: Final pipeline state with all results.
    """
    db = firestore.client()

    # Ensure user document exists
    user_ref = db.collection("users").document(user_id)
    user_ref.set(
        {"updatedAt": SERVER_TIMESTAMP},
        merge=True,
    )

    # Save the idea evaluation
    idea_ref = user_ref.collection("ideas").document(idea_id)
    idea_doc = {
        "rawInput": state.get("raw_transcript", ""),
        "sourceLanguage": state.get("source_language", "en"),
        "parsedOnDevice": state.get("parsed_on_device", False),
        "parsedInput": state.get("parsed_input", {}),
        "market": state.get("market", {}),
        "financial": state.get("financial", {}),
        "schemes": state.get("schemes", []),
        "risk": state.get("risk", {}),
        "status": state.get("status", "SUCCESS"),
        "evaluatedAt": SERVER_TIMESTAMP,
        "modelVersion": MODEL_VERSION,
    }

    idea_ref.set(idea_doc)


# ──────────────────────────────────────────────────────────────
# Key Naming Convention Helpers
# ──────────────────────────────────────────────────────────────


def _snake_to_camel(name: str) -> str:
    """Convert snake_case to camelCase."""
    components = name.split("_")
    return components[0] + "".join(x.title() for x in components[1:])


def _snake_to_camel_dict(d: dict) -> dict:
    """Recursively convert dict keys from snake_case to camelCase."""
    result = {}
    for key, value in d.items():
        camel_key = _snake_to_camel(key)
        if isinstance(value, dict):
            result[camel_key] = _snake_to_camel_dict(value)
        elif isinstance(value, list):
            result[camel_key] = [
                _snake_to_camel_dict(item) if isinstance(item, dict) else item
                for item in value
            ]
        else:
            result[camel_key] = value
    return result
