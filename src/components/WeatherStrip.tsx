import { useEffect, useState } from "react";
import { useWeather, type WeatherResult } from "../hooks/useWeather";
import type { ClimateStoryInput } from "../lib/climateStory";
import { calcWaypointTimes, formatArrivalTime } from "../lib/timing";
import type { Waypoint } from "../lib/weather";
import { getHistoricalYears, getWeatherCache, isForecastRange, isYrRange } from "../lib/weather";
import { routeBearingForWaypoint } from "../lib/wind";
import { WeatherCard } from "./WeatherCard";

type Props = {
  waypoints: Waypoint[];
  date: string | null;
  startTime?: string | null;
  finishTime?: string | null;
  /** Optional pre-fetched results. If provided, skips the internal useWeather call. */
  externalResults?: WeatherResult[];
  /** Optional callback fired when a waypoint card is clicked. */
  onWaypointClick?: (waypoint: Waypoint, index: number) => void;
  /** Total route distance in km. When provided, intermediate waypoints show an approximate distance label. */
  totalDistanceKm?: number;
  /** Explicit fractions (0–1) to use instead of the default even spread across waypoints. */
  fractions?: number[];
  /** Skip historical/climate data entirely and only show live forecast data. */
  forecastOnly?: boolean;
  /** All waypoints represent the same physical location (e.g. a time-only progress strip). Suppresses route-bearing wind classification. */
  sameLocation?: boolean;
  /** Shown faded, as a preview — the cards illustrate the feature but aren't tied to a real arrival time yet. */
  placeholder?: boolean;
};

export function WeatherStrip({
  waypoints,
  date,
  startTime,
  finishTime,
  externalResults,
  onWaypointClick,
  totalDistanceKm,
  fractions,
  forecastOnly,
  sameLocation,
  placeholder,
}: Props) {
  const timingActive =
    date != null &&
    startTime != null &&
    startTime !== "" &&
    finishTime != null &&
    finishTime !== "";

  const n = waypoints.length;
  const dynamicFractions =
    fractions ?? Array.from({ length: n }, (_, i) => (n === 1 ? 0 : i / (n - 1)));

  const datetimes = timingActive
    ? calcWaypointTimes(date, startTime, finishTime, dynamicFractions)
    : null;

  const internalResults = useWeather(externalResults ? [] : waypoints, date, datetimes);
  const results = externalResults ?? internalResults;

  const mode =
    date == null
      ? null
      : isYrRange(date)
        ? "yr-forecast"
        : isForecastRange(date)
          ? "forecast"
          : "climate-average";

  const [historicalYearsPerWaypoint, setHistoricalYearsPerWaypoint] = useState<ClimateStoryInput[]>(
    [],
  );

  useEffect(() => {
    if (!date || forecastOnly) return;
    let cancelled = false;
    getWeatherCache()
      .then((cache) => {
        if (cancelled) return;
        const all = waypoints.map((wp) => getHistoricalYears(cache, wp.lat, wp.lon, date));
        setHistoricalYearsPerWaypoint(all);
      })
      .catch(() => {
        if (!cancelled) setHistoricalYearsPerWaypoint([]);
      });
    return () => {
      cancelled = true;
    };
  }, [waypoints, date, forecastOnly]);

  return (
    <div className="weather-strip">
      <div className="weather-strip__cards">
        {results.map(({ waypoint, data, isLoading, isError }, i) => {
          // Only the first card shows real data before timing is set — the
          // rest are dashed-out stubs hinting that picking a start/finish
          // time unlocks a per-point breakdown.
          if (placeholder && i > 0) {
            return (
              <div
                className="weather-card weather-card--stub"
                // biome-ignore lint/suspicious/noArrayIndexKey: waypoints can share lat/lon, index disambiguates
                key={`${waypoint.lat}-${waypoint.lon}-${i}`}
              >
                <div className="weather-card__label">{waypoint.label}</div>
                <div className="weather-card__stub-dash">–</div>
              </div>
            );
          }
          return (
            <WeatherCard
              // biome-ignore lint/suspicious/noArrayIndexKey: waypoints can share lat/lon, index disambiguates
              key={`${waypoint.lat}-${waypoint.lon}-${i}`}
              waypoint={waypoint}
              data={data}
              isLoading={isLoading}
              isError={isError}
              arrivalTime={datetimes ? formatArrivalTime(datetimes[i]) : undefined}
              datetime={datetimes ? datetimes[i] : undefined}
              routeBearing={
                sameLocation ? undefined : (routeBearingForWaypoint(waypoints, i) ?? undefined)
              }
              onClick={onWaypointClick ? () => onWaypointClick(waypoint, i) : undefined}
              date={date}
              historicalYears={!forecastOnly && date ? historicalYearsPerWaypoint[i] : undefined}
              approximateDistanceKm={
                totalDistanceKm != null && n > 2 && i > 0 && i < n - 1
                  ? (i / (n - 1)) * totalDistanceKm
                  : undefined
              }
            />
          );
        })}
      </div>
      <div className="weather-strip__footer">
        <span className="weather-strip__swipe-hint">← Sveip for å se alle punkter →</span>
        {placeholder ? (
          <span className="weather-strip__banner">
            <i>Velg starttid og sluttid over for å se vær ved forventet tid på hvert punkt</i>
          </span>
        ) : (
          date && (
            <span className="weather-strip__banner">
              <i>
                {mode === "yr-forecast"
                  ? "Viser værvarsel fra Yr / MET Norway (opptil 9 dager)"
                  : mode === "forecast"
                    ? "Viser værvarsel fra Open-Meteo (dager 10–16)"
                    : "Viser klimagjennomsnitt (historiske data 2015–2024)"}
                {timingActive && " · Vær ved forventet ankomsttid"}
              </i>
            </span>
          )
        )}
      </div>
    </div>
  );
}
