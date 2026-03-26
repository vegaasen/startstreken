import { useWeather, isForecastRange } from "../hooks/useWeather";
import { WeatherCard } from "./WeatherCard";
import type { Waypoint } from "../lib/weather";
import { calcWaypointTimes, formatArrivalTime, WAYPOINT_FRACTIONS } from "../lib/timing";

type Props = {
  waypoints: Waypoint[];
  date: string | null;
  startTime?: string | null;
  finishTime?: string | null;
};

export function WeatherStrip({ waypoints, date, startTime, finishTime }: Props) {
  const timingActive =
    date != null &&
    startTime != null &&
    startTime !== "" &&
    finishTime != null &&
    finishTime !== "";

  const datetimes = timingActive
    ? calcWaypointTimes(date, startTime, finishTime, [...WAYPOINT_FRACTIONS])
    : null;

  const results = useWeather(waypoints, date, datetimes);

  const mode =
    date == null
      ? null
      : isForecastRange(date)
      ? "forecast"
      : "climate-average";

  return (
    <div className="weather-strip">
      {date && (
        <div className="weather-strip__banner">
          {mode === "forecast"
            ? "Viser værvarsel fra Open-Meteo (opptil 16 dager)"
            : "Viser klimagjennomsnitt (historiske data 2015–2024)"}
          {timingActive && " · Vær ved forventet ankomsttid"}
        </div>
      )}
      <div className="weather-strip__cards">
        {results.map(({ waypoint, data, isLoading, isError }, i) => (
          <WeatherCard
            key={`${waypoint.lat}-${waypoint.lon}`}
            waypoint={waypoint}
            data={data}
            isLoading={isLoading}
            isError={isError}
            arrivalTime={datetimes ? formatArrivalTime(datetimes[i]) : undefined}
          />
        ))}
      </div>
    </div>
  );
}
