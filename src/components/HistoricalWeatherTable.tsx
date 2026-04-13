import { useState } from "react";
import { useQueries } from "@tanstack/react-query";
import { fetchWeather } from "../lib/weather";
import { describeWeatherCode } from "../lib/wmo";
import type { Waypoint, WeatherData } from "../lib/weather";
import weatherCache from "../data/weather-cache.json";

const historicalByYear = weatherCache.historicalByYear as Record<string, WeatherData>;

type Props = {
  waypoints: Waypoint[];
  /** The ritt's official date (YYYY-MM-DD). We use only the MM-DD part. */
  officialDate: string;
};

const HISTORY_YEARS = Array.from({ length: 10 }, (_, i) => 2015 + i); // 2015–2024

/** Average an array of numbers, ignoring nullish entries */
function avg(vals: (number | undefined | null)[]): number | null {
  const clean = vals.filter((v): v is number => v != null);
  if (clean.length === 0) return null;
  return clean.reduce((a, b) => a + b, 0) / clean.length;
}

/** Most frequent item in an array */
function mode<T>(arr: T[]): T | undefined {
  if (arr.length === 0) return undefined;
  const counts = new Map<T, number>();
  for (const v of arr) counts.set(v, (counts.get(v) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0];
}

export function HistoricalWeatherTable({ waypoints, officialDate }: Props) {
  const [isOpen, setIsOpen] = useState(false);

  const [, mm, dd] = officialDate.split("-");

  // One query per (year × waypoint) = 10 × 5 = 50 queries max
  // Flat array: year 0 wp 0, year 0 wp 1, ..., year 1 wp 0, ...
  // Cache key for historicalByYear: "lat,lon,MM,DD,YYYY"
  const queryDefs = HISTORY_YEARS.flatMap((year) =>
    waypoints.map((wp) => {
      const date = `${year}-${mm}-${dd}`;
      const cacheKey = `${wp.lat},${wp.lon},${mm},${dd},${year}`;
      const cachedData = historicalByYear[cacheKey];
      return {
        queryKey: ["weather-history", wp.lat, wp.lon, date] as const,
        queryFn: () => fetchWeather(wp, date),
        staleTime: Infinity,
        retry: 1,
        enabled: isOpen && !cachedData,
        initialData: cachedData,
      };
    })
  );

  const results = useQueries({ queries: queryDefs });

  // Re-shape results into rows keyed by year
  const rows = HISTORY_YEARS.map((year, yi) => {
    const wpResults = waypoints.map((_, wi) => results[yi * waypoints.length + wi]);
    const allLoading = wpResults.some((r) => r.isLoading);
    const allError = wpResults.every((r) => r.isError);
    const datas = wpResults.map((r) => r.data);

    return {
      year,
      isLoading: allLoading,
      isError: allError,
      tempMax: avg(datas.map((d) => d?.tempMax)),
      tempMin: avg(datas.map((d) => d?.tempMin)),
      precipitation: avg(datas.map((d) => d?.precipitation)),
      windSpeed: avg(datas.map((d) => d?.windSpeed)),
      weatherCode: mode(datas.map((d) => d?.weatherCode).filter((c): c is number => c != null)),
    };
  });

  function handleToggle(e: React.MouseEvent<HTMLElement>) {
    const details = e.currentTarget.closest("details");
    if (details) setIsOpen(!details.open);
  }

  return (
    <details className="history-table__details">
      <summary className="history-table__summary" onClick={handleToggle}>
        Historisk vær på rittdagen (2015–2024)
      </summary>
      <div className="history-table__wrapper">
        <table className="history-table">
          <thead>
            <tr>
              <th>År</th>
              <th title="Gjennomsnittlig maks-temperatur">Maks °C</th>
              <th title="Gjennomsnittlig min-temperatur">Min °C</th>
              <th title="Gjennomsnittlig nedbør">Nedbør mm</th>
              <th title="Maks vindhastighet">Vind km/t</th>
              <th>Vær</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.year} className={row.isLoading ? "history-table__row--loading" : ""}>
                <td className="history-table__year">{row.year}</td>
                {row.isLoading ? (
                  <td colSpan={5} className="history-table__status">Laster…</td>
                ) : row.isError ? (
                  <td colSpan={5} className="history-table__status history-table__status--error">Ikke tilgjengelig</td>
                ) : (
                  <>
                    <td>{row.tempMax != null ? `${Math.round(row.tempMax * 10) / 10}°` : "–"}</td>
                    <td>{row.tempMin != null ? `${Math.round(row.tempMin * 10) / 10}°` : "–"}</td>
                    <td>{row.precipitation != null ? `${Math.round(row.precipitation * 10) / 10}` : "–"}</td>
                    <td>{row.windSpeed != null ? `${Math.round(row.windSpeed * 10) / 10}` : "–"}</td>
                    <td className="history-table__icon">
                      {row.weatherCode != null ? describeWeatherCode(row.weatherCode).emoji : "–"}
                    </td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
        <p className="history-table__note">
          Gjennomsnitt av alle målepunkter langs ruten for den aktuelle datoen hvert år.
        </p>
      </div>
    </details>
  );
}
