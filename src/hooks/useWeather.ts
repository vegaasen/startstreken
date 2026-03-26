import { useQuery } from "@tanstack/react-query";
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

  const queries = waypoints.map((wp, i) => {
    const datetime = hourlyMode ? datetimes[i] : null;
    const queryKey = datetime
      ? ["weather-hourly", wp.lat, wp.lon, datetime]
      : ["weather", wp.lat, wp.lon, date];
    const enabled = datetime ? true : !!date;

    // eslint-disable-next-line react-hooks/rules-of-hooks
    return useQuery<WeatherData>({
      queryKey,
      queryFn: () =>
        datetime
          ? fetchWeatherForDatetime(wp, datetime)
          : fetchWeather(wp, date!),
      enabled,
      staleTime: 1000 * 60 * 10, // 10 minutes
      retry: 2,
    });
  });

  return waypoints.map((wp, i) => ({
    waypoint: wp,
    data: queries[i].data,
    isLoading: queries[i].isLoading,
    isError: queries[i].isError,
  }));
}

export { isForecastRange };
