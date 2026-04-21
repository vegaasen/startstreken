/**
 * Sync script: fetches upcoming triathlon events from triatlonforbundet.no,
 * filters to Norwegian events at long-distance (run 42 km) or
 * standard/normal distance (run 10 km), geocodes each venue via Nominatim,
 * and writes the result to src/data/triathlon-events.json.
 *
 * Usage:
 *   bun scripts/fetch-triathlon-events.ts
 *
 * Run weekly via GitHub Actions (.github/workflows/refresh-triathlon.yml).
 */

import { writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SEARCH_API =
  "https://www.triatlonforbundet.no/api/events/search?distance=&cupType=&region=&eventType=&query=";
const BASE_URL = "https://www.triatlonforbundet.no";

/** Distance value IDs from the API that correspond to our supported distances */
const LONG_DISTANCE_ID = "4fcbbc6771a6364a91160da842933449"; // Langdistanse: 3800m swim + 180km bike + 42km run
const NORMAL_DISTANCE_IDS = [
  "c8fd0b8e58cb371eadf279bca89027e3", // Normal: 1500m + 40km + 10km
  "5a90b340a3213aac9fab0e7830035b50", // Standarddistanse: 1500m + 40km + 10km
];
const SUPPORTED_DISTANCE_IDS = new Set([LONG_DISTANCE_ID, ...NORMAL_DISTANCE_IDS]);

/** Region value "5" = Internasjonalt — exclude these */
const INTERNATIONAL_REGION = "5";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ApiEvent = {
  distances: string[];
  regions: string[];
  eventTypes: string[];
  months: string[];
  day: string;
  date: string; // "M/D/YYYY"
  name: string;
  teaserText: string;
  url: string;
};

type ApiResponse = {
  results: ApiEvent[];
};

type Waypoint = {
  label: string;
  lat: number;
  lon: number;
  altitude?: number;
};

type TriathlonEvent = {
  id: string;
  name: string;
  discipline: "triathlon";
  officialDate: string;
  distance: number;
  distanceLabel: string;
  region: string;
  url: string;
  waypoints: Waypoint[];
  elevationGain?: number;
};

type NominatimResult = {
  lat: string;
  lon: string;
  display_name: string;
  address?: {
    county?: string;
    state?: string;
    city?: string;
    town?: string;
    village?: string;
    municipality?: string;
  };
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/** Parse "M/D/YYYY" to "YYYY-MM-DD" */
function parseDate(raw: string): string {
  const [m, d, y] = raw.split("/");
  return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
}

/** Slugify an event name to a stable ID */
function toId(name: string): string {
  return name
    .toLowerCase()
    .replace(/[æ]/g, "ae")
    .replace(/[ø]/g, "o")
    .replace(/[å]/g, "a")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Extract the most likely venue/city from an event detail page.
 * The page is HTML; we look for common patterns in Norwegian event pages.
 */
function extractVenueFromHtml(html: string, eventName: string): string {
  // Try <meta name="description" ...> for a location mention
  const metaDesc = html.match(/<meta\s+name="description"\s+content="([^"]+)"/i);
  if (metaDesc) {
    const desc = metaDesc[1];
    // Look for "i <City>" or "på <City>" patterns
    const inMatch = desc.match(/\bi ([A-ZÆØÅ][a-zæøå]+(?:\s+[A-ZÆØÅ][a-zæøå]+)?)/);
    if (inMatch) return inMatch[1];
  }

  // Look for og:description
  const ogDesc = html.match(/<meta\s+property="og:description"\s+content="([^"]+)"/i);
  if (ogDesc) {
    const inMatch = ogDesc[1].match(/\bi ([A-ZÆØÅ][a-zæøå]+(?:\s+[A-ZÆØÅ][a-zæøå]+)?)/);
    if (inMatch) return inMatch[1];
  }

  // Fall back: extract city-like word from event name
  // e.g. "Hove Tri" → skip, "Trondheim triatlon" → "Trondheim"
  const nameWords = eventName.split(/\s+/);
  for (const word of nameWords) {
    if (word.length > 4 && /^[A-ZÆØÅ]/.test(word) && !/tri(atlon)?/i.test(word)) {
      return word;
    }
  }

  return eventName;
}

/**
 * Geocode a venue string via Nominatim (OpenStreetMap).
 * Returns null if no result found.
 */
async function geocode(query: string): Promise<NominatimResult | null> {
  const params = new URLSearchParams({
    q: `${query}, Norway`,
    format: "json",
    limit: "1",
    addressdetails: "1",
  });

  try {
    const res = await fetch(`https://nominatim.openstreetmap.org/search?${params.toString()}`, {
      headers: {
        // Nominatim requires a meaningful User-Agent
        "User-Agent": "loypevaer-triathlon-sync/1.0 (github.com/vegaasen/loypevaer)",
      },
    });
    if (!res.ok) return null;
    const results = (await res.json()) as NominatimResult[];
    return results[0] ?? null;
  } catch {
    return null;
  }
}

/**
 * Extract a human-readable region from a Nominatim result.
 */
function regionFromNominatim(result: NominatimResult): string {
  const a = result.address ?? {};
  return a.county ?? a.state ?? a.municipality ?? a.city ?? a.town ?? a.village ?? "Norge";
}

/**
 * Determine the "standard" race distance (swim/bike/run) from distance IDs.
 */
function distanceFromIds(ids: string[]): { km: number; label: string } {
  if (ids.includes(LONG_DISTANCE_ID)) {
    return { km: 226, label: "Langdistanse (3.8km svøm / 180km sykkel / 42km løp)" };
  }
  return { km: 51, label: "Standarddistanse (1.5km svøm / 40km sykkel / 10km løp)" };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log("Fetching triatlonforbundet.no event calendar…");

  const searchRes = await fetch(SEARCH_API);
  if (!searchRes.ok) {
    throw new Error(`Failed to fetch search API: ${searchRes.status} ${searchRes.statusText}`);
  }
  const data = (await searchRes.json()) as ApiResponse;
  const allEvents = data.results;

  // Filter: Norwegian only + supported distances only
  const filtered = allEvents.filter((e) => {
    if (e.regions.includes(INTERNATIONAL_REGION) && e.regions.length === 1) return false;
    if (e.regions.length === 0) return false; // no region = skip
    const hasSupportedDist = e.distances.some((d) => SUPPORTED_DISTANCE_IDS.has(d));
    return hasSupportedDist;
  });

  console.log(`  ${allEvents.length} total events → ${filtered.length} after filtering`);

  const output: TriathlonEvent[] = [];

  for (const event of filtered) {
    const officialDate = parseDate(event.date);
    const { km, label } = distanceFromIds(event.distances);
    const eventUrl = `${BASE_URL}${event.url}`;

    console.log(`  Processing: ${event.name} (${officialDate})`);

    // Fetch detail page to extract venue
    let venue = event.name;
    try {
      await sleep(500); // be polite
      const detailRes = await fetch(eventUrl, {
        headers: { "User-Agent": "loypevaer-triathlon-sync/1.0" },
      });
      if (detailRes.ok) {
        const html = await detailRes.text();
        venue = extractVenueFromHtml(html, event.name);
      }
    } catch {
      console.warn(`    Could not fetch detail page for ${event.name}`);
    }

    console.log(`    Venue guess: "${venue}" — geocoding…`);

    // Geocode venue
    await sleep(1100); // Nominatim requires ≥1s between requests
    const geo = await geocode(venue);

    if (!geo) {
      console.warn(`    No geocode result for "${venue}", skipping`);
      continue;
    }

    const lat = parseFloat(geo.lat);
    const lon = parseFloat(geo.lon);
    const region = regionFromNominatim(geo);

    console.log(`    → ${lat.toFixed(3)}, ${lon.toFixed(3)} (${region})`);

    output.push({
      id: toId(event.name),
      name: event.name,
      discipline: "triathlon",
      officialDate,
      distance: km,
      distanceLabel: label,
      region,
      url: eventUrl,
      waypoints: [
        { label: `Start/Mål – ${venue}`, lat, lon },
      ],
    });
  }

  const outputPath = resolve(__dirname, "../src/data/triathlon-events.json");
  writeFileSync(
    outputPath,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        source: "triatlonforbundet.no",
        events: output,
      },
      null,
      2
    )
  );

  console.log(`\nWrote ${output.length} events to src/data/triathlon-events.json`);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
