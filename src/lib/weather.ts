import weatherCache from "../data/weather-cache.json";

export type Waypoint = {
  label: string;
  lat: number;
  lon: number;
  altitude?: number;
};

export type WeatherData = {
  source: "forecast" | "climate-average";
  tempMax: number;
  tempMin: number;
  precipitation: number;
  windSpeed: number;
  weatherCode: number;
  /** Present when fetched for a specific hour (hourly mode) */
  hourlyTemp?: number;
  hourlyPrecipitation?: number;
  hourlyWindSpeed?: number;
};

const FORECAST_URL = "https://api.open-meteo.com/v1/forecast";
const ARCHIVE_URL = "https://archive-api.open-meteo.com/v1/archive";

const DAILY_PARAMS =
  "temperature_2m_max,temperature_2m_min,precipitation_sum,wind_speed_10m_max,weather_code";

const HOURLY_PARAMS = "temperature_2m,precipitation,wind_speed_10m,weather_code";

/** Parses "YYYY-MM-DDTHH:00" into { date: "YYYY-MM-DD", hour: number } */
function parseDatetime(datetime: string): { date: string; hour: number } {
  const [date, time] = datetime.split("T");
  const hour = parseInt(time?.split(":")?.[0] ?? "0", 10);
  return { date, hour };
}

/** Returns true if selectedDate is within 16 days from today */
export function isForecastRange(date: string): boolean {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(date);
  const diffDays = (target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24);
  return diffDays >= 0 && diffDays <= 16;
}

export async function fetchForecastWeather(
  waypoint: Waypoint,
  date: string
): Promise<WeatherData> {
  const params = new URLSearchParams({
    latitude: String(waypoint.lat),
    longitude: String(waypoint.lon),
    ...(waypoint.altitude !== undefined ? { elevation: String(waypoint.altitude) } : {}),
    daily: DAILY_PARAMS,
    start_date: date,
    end_date: date,
    timezone: "Europe/Oslo",
  });

  const res = await fetch(`${FORECAST_URL}?${params}`);
  if (!res.ok) throw new Error(`Open-Meteo forecast error: ${res.status}`);
  const json = await res.json();

  const d = json.daily;
  return {
    source: "forecast",
    tempMax: d.temperature_2m_max[0],
    tempMin: d.temperature_2m_min[0],
    precipitation: d.precipitation_sum[0] ?? 0,
    windSpeed: d.wind_speed_10m_max[0] ?? 0,
    weatherCode: d.weather_code[0] ?? 0,
  };
}

/**
 * Fetches the same calendar date across the past 10 years from the archive
 * and returns a simple average as a climate estimate.
 *
 * Checks the pre-built weather cache first (src/data/weather-cache.json).
 * Falls back to live API calls only if the cache entry is missing.
 */
export async function fetchClimateAverage(
  waypoint: Waypoint,
  date: string
): Promise<WeatherData> {
  const [, month, day] = date.split("-");
  const cacheKey = `${waypoint.lat},${waypoint.lon},${month},${day}`;
  const cached = (weatherCache.climateAverages as Record<string, WeatherData>)[cacheKey];
  if (cached) return cached;

  const startYear = 2015;
  const endYear = 2024;

  // Build start/end covering all years in one request (full months to avoid
  // missing days at boundaries) — then filter client-side to the exact month-day.
  // Fetch each year individually to get the exact date (archive needs exact ranges)
  const yearFetches = Array.from({ length: endYear - startYear + 1 }, (_, i) => {
    const year = startYear + i;
    const d = `${year}-${month}-${day}` as string;
    const params = new URLSearchParams({
      latitude: String(waypoint.lat),
      longitude: String(waypoint.lon),
      ...(waypoint.altitude !== undefined ? { elevation: String(waypoint.altitude) } : {}),
      daily: DAILY_PARAMS,
      start_date: d,
      end_date: d,
      timezone: "Europe/Oslo",
    });
    return fetch(`${ARCHIVE_URL}?${params}`).then((r) => {
      if (!r.ok) return null;
      return r.json();
    });
  });

  const results = await Promise.all(yearFetches);
  const valid = results.filter(Boolean);

  if (valid.length === 0) throw new Error("No climate archive data available");

  const avg = (key: string) => {
    const vals = valid
      .map((r) => r.daily[key]?.[0])
      .filter((v) => v !== null && v !== undefined) as number[];
    return vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
  };

  // Most common weather code across sampled years
  const codes = valid
    .map((r) => r.daily.weather_code?.[0])
    .filter((v) => v !== null && v !== undefined) as number[];
  const weatherCode =
    codes.length > 0
      ? Number(
          Object.entries(
            codes.reduce<Record<number, number>>((acc, c) => {
              acc[c] = (acc[c] ?? 0) + 1;
              return acc;
            }, {})
          ).sort((a, b) => b[1] - a[1])[0][0]
        )
      : 0;

  return {
    source: "climate-average",
    tempMax: Math.round(avg("temperature_2m_max") * 10) / 10,
    tempMin: Math.round(avg("temperature_2m_min") * 10) / 10,
    precipitation: Math.round(avg("precipitation_sum") * 10) / 10,
    windSpeed: Math.round(avg("wind_speed_10m_max") * 10) / 10,
    weatherCode,
  };
}

export async function fetchWeather(
  waypoint: Waypoint,
  date: string
): Promise<WeatherData> {
  if (isForecastRange(date)) {
    return fetchForecastWeather(waypoint, date);
  }
  return fetchClimateAverage(waypoint, date);
}

/**
 * Fetches hourly forecast weather for a specific datetime ("YYYY-MM-DDTHH:00").
 * Falls back to daily data for tempMax/tempMin.
 */
export async function fetchForecastWeatherHourly(
  waypoint: Waypoint,
  datetime: string
): Promise<WeatherData> {
  const { date, hour } = parseDatetime(datetime);

  const params = new URLSearchParams({
    latitude: String(waypoint.lat),
    longitude: String(waypoint.lon),
    ...(waypoint.altitude !== undefined ? { elevation: String(waypoint.altitude) } : {}),
    hourly: HOURLY_PARAMS,
    daily: "temperature_2m_max,temperature_2m_min",
    start_date: date,
    end_date: date,
    timezone: "Europe/Oslo",
  });

  const res = await fetch(`${FORECAST_URL}?${params}`);
  if (!res.ok) throw new Error(`Open-Meteo forecast error: ${res.status}`);
  const json = await res.json();

  const h = json.hourly;
  // hourly arrays have 24 entries (one per hour); index matches the hour
  return {
    source: "forecast",
    tempMax: json.daily.temperature_2m_max[0],
    tempMin: json.daily.temperature_2m_min[0],
    precipitation: h.precipitation[hour] ?? 0,
    windSpeed: h.wind_speed_10m[hour] ?? 0,
    weatherCode: h.weather_code[hour] ?? 0,
    hourlyTemp: h.temperature_2m[hour] ?? null,
    hourlyPrecipitation: h.precipitation[hour] ?? 0,
    hourlyWindSpeed: h.wind_speed_10m[hour] ?? 0,
  };
}

/**
 * Fetches hourly climate average for a specific datetime across the past 10 years.
 */
export async function fetchClimateAverageHourly(
  waypoint: Waypoint,
  datetime: string
): Promise<WeatherData> {
  const { date, hour } = parseDatetime(datetime);
  const [, month, day] = date.split("-");

  const startYear = 2015;
  const endYear = 2024;

  const yearFetches = Array.from({ length: endYear - startYear + 1 }, (_, i) => {
    const year = startYear + i;
    const d = `${year}-${month}-${day}`;
    const params = new URLSearchParams({
      latitude: String(waypoint.lat),
      longitude: String(waypoint.lon),
      ...(waypoint.altitude !== undefined ? { elevation: String(waypoint.altitude) } : {}),
      hourly: HOURLY_PARAMS,
      daily: "temperature_2m_max,temperature_2m_min",
      start_date: d,
      end_date: d,
      timezone: "Europe/Oslo",
    });
    return fetch(`${ARCHIVE_URL}?${params}`).then((r) => {
      if (!r.ok) return null;
      return r.json();
    });
  });

  const results = await Promise.all(yearFetches);
  const valid = results.filter(Boolean);

  if (valid.length === 0) throw new Error("No climate archive data available");

  const avgHourly = (key: string) => {
    const vals = valid
      .map((r) => r.hourly[key]?.[hour])
      .filter((v) => v !== null && v !== undefined) as number[];
    return vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
  };

  const avgDaily = (key: string) => {
    const vals = valid
      .map((r) => r.daily[key]?.[0])
      .filter((v) => v !== null && v !== undefined) as number[];
    return vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
  };

  const codes = valid
    .map((r) => r.hourly.weather_code?.[hour])
    .filter((v) => v !== null && v !== undefined) as number[];
  const weatherCode =
    codes.length > 0
      ? Number(
          Object.entries(
            codes.reduce<Record<number, number>>((acc, c) => {
              acc[c] = (acc[c] ?? 0) + 1;
              return acc;
            }, {})
          ).sort((a, b) => b[1] - a[1])[0][0]
        )
      : 0;

  const hourlyTemp = Math.round(avgHourly("temperature_2m") * 10) / 10;
  const hourlyPrecipitation = Math.round(avgHourly("precipitation") * 10) / 10;
  const hourlyWindSpeed = Math.round(avgHourly("wind_speed_10m") * 10) / 10;

  return {
    source: "climate-average",
    tempMax: Math.round(avgDaily("temperature_2m_max") * 10) / 10,
    tempMin: Math.round(avgDaily("temperature_2m_min") * 10) / 10,
    precipitation: hourlyPrecipitation,
    windSpeed: hourlyWindSpeed,
    weatherCode,
    hourlyTemp,
    hourlyPrecipitation,
    hourlyWindSpeed,
  };
}

/**
 * Fetches weather for a specific datetime (hourly mode).
 * When datetime is provided, uses hourly data; otherwise falls back to daily.
 */
export async function fetchWeatherForDatetime(
  waypoint: Waypoint,
  datetime: string
): Promise<WeatherData> {
  if (isForecastRange(datetime.split("T")[0])) {
    return fetchForecastWeatherHourly(waypoint, datetime);
  }
  return fetchClimateAverageHourly(waypoint, datetime);
}
