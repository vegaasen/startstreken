import { useQueries } from "@tanstack/react-query";
import { fetchWeather, fetchWeatherForDatetime, isForecastRange } from "../lib/weather";
import type { Waypoint, WeatherData } from "../lib/weather";

export type WaypointWeather = {
  waypoint: Waypoint;
  data: WeatherData | undefined;
  isLoading: boolean;
  isError: boolean;
};

/**
 * Fetches weather for each waypoint.
 *
 * When `datetimes` is provided (one per waypoint, "YYYY-MM-DDTHH:00"), hourly
 * weather is fetched for the expected arrival time at each point. When absent,
 * falls back to daily weather for the given `date`.
 */
export function useWeather(
  waypoints: Waypoint[],
  date: string | null,
  datetimes?: string[] | null
): WaypointWeather[] {
  const hourlyMode = datetimes != null && datetimes.length === waypoints.length;

  const results = useQueries({
    queries: waypoints.map((wp, i) => {
      const datetime = hourlyMode ? datetimes[i] : null;
      return {
        queryKey: datetime
          ? ["weather-hourly", wp.lat, wp.lon, datetime]
          : ["weather", wp.lat, wp.lon, date],
        queryFn: () =>
          datetime
            ? fetchWeatherForDatetime(wp, datetime)
            : fetchWeather(wp, date!),
        enabled: datetime ? true : !!date,
        staleTime: 1000 * 60 * 10, // 10 minutes
        retry: 2,
      };
    }),
  });

  return waypoints.map((wp, i) => ({
    waypoint: wp,
    data: results[i].data,
    isLoading: results[i].isLoading,
    isError: results[i].isError,
  }));
}

export { isForecastRange };
