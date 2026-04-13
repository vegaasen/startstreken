/**
 * Build-time script: pre-fetches all climate-average and historical-by-year
 * weather data for every ritt in ritt.json, using the Open-Meteo archive API.
 *
 * Writes the result to src/data/weather-cache.json.
 *
 * Usage:
 *   bun scripts/fetch-weather-cache.ts
 *
 * Runs at build time (and nightly via GitHub Actions) to eliminate runtime
 * rate-limit issues with the archive API.
 */

import { writeFileSync, readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

// ---------------------------------------------------------------------------
// Types (kept local — script has no access to src/lib/weather.ts types at
// runtime since we don't want to depend on the Vite/browser module graph)
// ---------------------------------------------------------------------------

type Waypoint = {
  label: string;
  lat: number;
  lon: number;
  altitude?: number;
};

type Ritt = {
  id: string;
  name: string;
  officialDate: string;
  waypoints: Waypoint[];
};

type WeatherEntry = {
  source: "climate-average";
  tempMax: number;
  tempMin: number;
  precipitation: number;
  windSpeed: number;
  weatherCode: number;
};

type WeatherCache = {
  generatedAt: string;
  /** Key: "lat,lon,MM,DD" → averaged WeatherData across 2015–2024 */
  climateAverages: Record<string, WeatherEntry>;
  /** Key: "lat,lon,MM,DD,YYYY" → single-year WeatherData for historical table */
  historicalByYear: Record<string, WeatherEntry>;
};

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const ARCHIVE_URL = "https://archive-api.open-meteo.com/v1/archive";
const DAILY_PARAMS =
  "temperature_2m_max,temperature_2m_min,precipitation_sum,wind_speed_10m_max,weather_code";
const START_YEAR = 2015;
const END_YEAR = 2024;
const CONCURRENCY = 2; // max parallel requests (Open-Meteo free tier: gentle rate limit)
const REQUEST_DELAY_MS = 200; // delay between requests per worker

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Simple concurrency-limited promise queue with per-task delay */
async function runWithConcurrency<T>(
  tasks: (() => Promise<T>)[],
  limit: number,
  delayMs: number = 0
): Promise<T[]> {
  const results: T[] = new Array(tasks.length);
  let idx = 0;

  async function worker() {
    while (idx < tasks.length) {
      const i = idx++;
      results[i] = await tasks[i]();
      if (delayMs > 0) await sleep(delayMs);
    }
  }

  const workers = Array.from({ length: Math.min(limit, tasks.length) }, worker);
  await Promise.all(workers);
  return results;
}

function waypointKey(wp: Waypoint, mm: string, dd: string): string {
  return `${wp.lat},${wp.lon},${mm},${dd}`;
}

function historicalKey(wp: Waypoint, mm: string, dd: string, year: number): string {
  return `${wp.lat},${wp.lon},${mm},${dd},${year}`;
}

// ---------------------------------------------------------------------------
// API fetch — single year, single waypoint
// ---------------------------------------------------------------------------

type RawDailyResult = {
  tempMax: number | null;
  tempMin: number | null;
  precipitation: number | null;
  windSpeed: number | null;
  weatherCode: number | null;
};

async function fetchArchiveDay(
  wp: Waypoint,
  date: string,
  retries = 3
): Promise<RawDailyResult | null> {
  const params = new URLSearchParams({
    latitude: String(wp.lat),
    longitude: String(wp.lon),
    ...(wp.altitude !== undefined ? { elevation: String(wp.altitude) } : {}),
    daily: DAILY_PARAMS,
    start_date: date,
    end_date: date,
    timezone: "Europe/Oslo",
  });

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(`${ARCHIVE_URL}?${params}`);
      if (res.status === 429) {
        // Back off and retry
        const backoff = 2000 * (attempt + 1);
        console.warn(`  Rate limited (429) for ${date} @ ${wp.label}, retrying in ${backoff}ms…`);
        await sleep(backoff);
        continue;
      }
      if (!res.ok) {
        console.warn(`  Archive API ${res.status} for ${date} @ ${wp.label}`);
        return null;
      }
      const json = await res.json();
      const d = json.daily;
      return {
        tempMax: d.temperature_2m_max?.[0] ?? null,
        tempMin: d.temperature_2m_min?.[0] ?? null,
        precipitation: d.precipitation_sum?.[0] ?? null,
        windSpeed: d.wind_speed_10m_max?.[0] ?? null,
        weatherCode: d.weather_code?.[0] ?? null,
      };
    } catch (err) {
      if (attempt < retries) {
        await sleep(1000 * (attempt + 1));
        continue;
      }
      console.warn(`  Fetch error for ${date} @ ${wp.label}:`, err);
      return null;
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Statistics helpers
// ---------------------------------------------------------------------------

function average(vals: (number | null)[]): number {
  const clean = vals.filter((v): v is number => v !== null);
  if (clean.length === 0) return 0;
  return Math.round((clean.reduce((a, b) => a + b, 0) / clean.length) * 10) / 10;
}

function statisticalMode(vals: (number | null)[]): number {
  const clean = vals.filter((v): v is number => v !== null);
  if (clean.length === 0) return 0;
  const freq: Record<number, number> = {};
  for (const v of clean) freq[v] = (freq[v] ?? 0) + 1;
  return Number(Object.entries(freq).sort((a, b) => b[1] - a[1])[0][0]);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const rittPath = resolve(__dirname, "../src/data/ritt.json");
  const outputPath = resolve(__dirname, "../src/data/weather-cache.json");

  const ritts: Ritt[] = JSON.parse(readFileSync(rittPath, "utf-8")) as Ritt[];

  // Collect all unique (wp, MM, DD) combinations to avoid duplicate fetches
  type FetchJob = { wp: Waypoint; mm: string; dd: string; year: number };

  const jobs: FetchJob[] = [];
  const seen = new Set<string>();

  for (const ritt of ritts) {
    const [, mm, dd] = ritt.officialDate.split("-");
    for (const wp of ritt.waypoints) {
      for (let year = START_YEAR; year <= END_YEAR; year++) {
        const key = historicalKey(wp, mm, dd, year);
        if (!seen.has(key)) {
          seen.add(key);
          jobs.push({ wp, mm, dd, year });
        }
      }
    }
  }

  console.log(
    `Fetching ${jobs.length} archive data points ` +
      `(${CONCURRENCY} concurrent, ~${Math.ceil(jobs.length / CONCURRENCY)} rounds)…`
  );

  const cache: WeatherCache = {
    generatedAt: new Date().toISOString(),
    climateAverages: {},
    historicalByYear: {},
  };

  // Fetch all jobs with concurrency limit
  let completed = 0;
  const tasks = jobs.map((job) => async () => {
    const date = `${job.year}-${job.mm}-${job.dd}`;
    const result = await fetchArchiveDay(job.wp, date);
    completed++;
    if (completed % 50 === 0 || completed === jobs.length) {
      process.stdout.write(`\r  ${completed}/${jobs.length} fetched…`);
    }

    if (result) {
      const hKey = historicalKey(job.wp, job.mm, job.dd, job.year);
      cache.historicalByYear[hKey] = {
        source: "climate-average",
        tempMax: result.tempMax ?? 0,
        tempMin: result.tempMin ?? 0,
        precipitation: result.precipitation ?? 0,
        windSpeed: result.windSpeed ?? 0,
        weatherCode: result.weatherCode ?? 0,
      };
    }

    return { job, result };
  });

  await runWithConcurrency(tasks, CONCURRENCY, REQUEST_DELAY_MS);
  console.log(); // newline after progress

  // Small pause before next batch (be polite to the API)
  await sleep(1000);

  // Build climate averages from the per-year data we just collected
  console.log("Computing climate averages…");

  // Group per (wp, MM, DD) and average across years
  const grouped: Record<string, (number | null)[][]> = {};
  // Index: 0=tempMax, 1=tempMin, 2=precipitation, 3=windSpeed, 4=weatherCode

  for (const ritt of ritts) {
    const [, mm, dd] = ritt.officialDate.split("-");
    for (const wp of ritt.waypoints) {
      const cKey = waypointKey(wp, mm, dd);
      if (cache.climateAverages[cKey]) continue; // already computed

      const yearlyData: RawDailyResult[] = [];
      for (let year = START_YEAR; year <= END_YEAR; year++) {
        const hKey = historicalKey(wp, mm, dd, year);
        const entry = cache.historicalByYear[hKey];
        if (entry) {
          yearlyData.push({
            tempMax: entry.tempMax,
            tempMin: entry.tempMin,
            precipitation: entry.precipitation,
            windSpeed: entry.windSpeed,
            weatherCode: entry.weatherCode,
          });
        }
      }

      if (yearlyData.length === 0) continue;

      cache.climateAverages[cKey] = {
        source: "climate-average",
        tempMax: average(yearlyData.map((d) => d.tempMax)),
        tempMin: average(yearlyData.map((d) => d.tempMin)),
        precipitation: average(yearlyData.map((d) => d.precipitation)),
        windSpeed: average(yearlyData.map((d) => d.windSpeed)),
        weatherCode: statisticalMode(yearlyData.map((d) => d.weatherCode)),
      };
    }
  }

  console.log(
    `  ${Object.keys(cache.climateAverages).length} climate averages computed`
  );
  console.log(
    `  ${Object.keys(cache.historicalByYear).length} historical-by-year entries`
  );

  writeFileSync(outputPath, JSON.stringify(cache, null, 2));
  console.log(`\nCache written to src/data/weather-cache.json`);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
