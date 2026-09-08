/**
 * Sync script: fetches upcoming Norwegian running events from racedays.run,
 * picks the longest race distance per event (5–39.5 km range),
 * geocodes each venue via Nominatim, and writes the result to
 * src/data/running-events.json.
 *
 * Usage:
 *   bun scripts/fetch-running-events.ts
 *
 * Run weekly via GitHub Actions (.github/workflows/refresh-running.yml).
 */

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const RACEDAYS_API =
  "https://www.racedays.run/api/event?pageSize=500&pageNumber=1&ascending=True&orderBy=Date&countryCode=NO&minMeters=4900&maxMeters=39500&includeWeeklyEvents=False&includeCarousels=False&onlyInternal=False&confirmedDates=True";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type RacedaysRace = {
  distanceName: string;
  meters: number;
  surface: number;
};

type RacedaysEvent = {
  id: string;
  name: string;
  slug: string;
  organizer: string | null;
  date: string; // "YYYY-MM-DD"
  dateStatus: number;
  image: string | null;
  location: string;
  country: string;
  type: number;
  races: RacedaysRace[];
};

type RacedaysResponse = {
  data: RacedaysEvent[];
  numberOfItems: number;
  totalNumberOfItems: number;
};

type Waypoint = {
  label: string;
  lat: number;
  lon: number;
  altitude?: number;
};

type RunningEvent = {
  id: string;
  name: string;
  discipline: "løping";
  officialDate: string;
  distance: number;
  distanceLabel: string;
  region: string;
  url: string;
  waypoints: Waypoint[];
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
// Distance overrides
// Override the auto-selected (longest) distance for specific events where
// the racedays.run data is incorrect or we want a specific distance.
// Key: event slug, Value: preferred distance in meters
// ---------------------------------------------------------------------------

const DISTANCE_OVERRIDES: Record<string, number> = {
  "obos-fornebulopet-2026": 10000, // racedays lists 18 km which doesn't exist; race is 10 km
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
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
        "User-Agent": "loypevaer-running-sync/1.0 (github.com/vegaasen/loypevaer)",
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
 * Pick the longest race from an event's races array (within our 5–39.5 km window).
 */
function pickLongestRace(races: RacedaysRace[]): RacedaysRace | null {
  const inRange = races.filter((r) => r.meters >= 4900 && r.meters <= 39500);
  if (inRange.length === 0) return null;
  return inRange.reduce((best, r) => (r.meters > best.meters ? r : best));
}

/**
 * Format meters as a human-readable distance label.
 */
function metersToLabel(meters: number): string {
  if (meters === 21097) return "Halvmaraton (21,1 km)";
  if (meters >= 20000 && meters <= 22000) return `Halvmaraton (~${(meters / 1000).toFixed(1)} km)`;
  const km = meters / 1000;
  return `${km % 1 === 0 ? km.toFixed(0) : km.toFixed(1)} km`;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log("Fetching running events from racedays.run…");

  const res = await fetch(RACEDAYS_API, {
    headers: {
      "User-Agent": "loypevaer-running-sync/1.0 (github.com/vegaasen/loypevaer)",
    },
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch racedays API: ${res.status} ${res.statusText}`);
  }

  const data = (await res.json()) as RacedaysResponse;
  const allEvents = data.data;
  console.log(
    `  ${allEvents.length} events fetched (total in dataset: ${data.totalNumberOfItems})`,
  );

  // Filter: future events only, must have at least one race in our range
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const filtered = allEvents.filter((e) => {
    if (new Date(`${e.date}T00:00:00`) < today) return false;
    return pickLongestRace(e.races) !== null;
  });

  console.log(`  ${filtered.length} future events with valid distances`);

  const outputPath = resolve(__dirname, "../src/data/running-events.json");

  // Preserve past events across the full-overwrite: the API only returns
  // future/confirmed events, so once a race's date passes it would otherwise
  // vanish from our data entirely instead of staying visible as a past event.
  let pastEvents: RunningEvent[] = [];
  if (existsSync(outputPath)) {
    try {
      const existing = JSON.parse(readFileSync(outputPath, "utf-8")) as { events: RunningEvent[] };
      pastEvents = (existing.events ?? []).filter(
        (e) => new Date(`${e.officialDate}T00:00:00`) < today,
      );
    } catch {
      console.warn("  Could not parse existing running-events.json, starting fresh");
    }
  }
  console.log(`  ${pastEvents.length} past events carried over from existing data`);

  const output: RunningEvent[] = [];
  // Track seen IDs to handle duplicates from slugification
  const seenIds = new Set<string>();

  for (const event of filtered) {
    const overrideMeters = DISTANCE_OVERRIDES[event.slug];
    const race = overrideMeters
      ? (event.races.find((r) => r.meters === overrideMeters) ?? pickLongestRace(event.races))!
      : pickLongestRace(event.races)!;
    const location = event.location;

    console.log(`  Processing: ${event.name} @ ${location} (${race.distanceName})`);

    // Geocode the location
    await sleep(1100); // Nominatim requires ≥1s between requests
    const geo = await geocode(location);

    if (!geo) {
      console.warn(`    No geocode result for "${location}", skipping`);
      continue;
    }

    const lat = parseFloat(geo.lat);
    const lon = parseFloat(geo.lon);
    const region = regionFromNominatim(geo);

    console.log(`    → ${lat.toFixed(3)}, ${lon.toFixed(3)} (${region})`);

    // Generate a stable unique ID
    let id = toId(event.name);
    if (seenIds.has(id)) {
      id = `${id}-${event.date}`;
    }
    seenIds.add(id);

    const eventUrl = `https://www.racedays.run/event/${event.slug}`;

    output.push({
      id,
      name: event.name,
      discipline: "løping",
      officialDate: event.date,
      distance: Math.round(race.meters / 100) / 10,
      distanceLabel: metersToLabel(race.meters),
      region,
      url: eventUrl,
      waypoints: [{ label: `Start/Mål – ${location}`, lat, lon }],
    });
  }

  // Merge past events back in; freshly fetched data wins on id collisions.
  const byId = new Map<string, RunningEvent>();
  for (const e of pastEvents) byId.set(e.id, e);
  for (const e of output) byId.set(e.id, e);
  const mergedEvents = [...byId.values()].sort((a, b) =>
    a.officialDate.localeCompare(b.officialDate),
  );

  writeFileSync(
    outputPath,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        source: "racedays.run",
        events: mergedEvents,
      },
      null,
      2,
    ),
  );

  console.log(`\nWrote ${mergedEvents.length} events to src/data/running-events.json`);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
