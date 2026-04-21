import { useParams, useSearchParams, Link } from "react-router-dom";
import { useState, useEffect } from "react";
import { DatePicker } from "../components/DatePicker";
import { TimePicker } from "../components/TimePicker";
import { WeatherStrip } from "../components/WeatherStrip";
import { RittMap } from "../components/RittMap";
import { HistoricalWeatherTable } from "../components/HistoricalWeatherTable";
import { GearSuggestion } from "../components/GearSuggestion";
import { ElevationProfile } from "../components/ElevationProfile";
import { ErrorBoundary } from "../components/ErrorBoundary";
import { computeElevationGain, allArrangements } from "../lib/ritt";
import { physicalScore, weatherAdjustment, scoreToLabel } from "../lib/difficulty";
import { useMyRitt } from "../hooks/useMyRitt";
import { usePageTitle } from "../hooks/usePageTitle";
import { useWeather } from "../hooks/useWeather";
import { calcWaypointTimes, WAYPOINT_FRACTIONS } from "../lib/timing";
import { ShareButton } from "../components/ShareButton";

export function RittPage() {
  const { id } = useParams<{ id: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const { isPlanned, getPlanned, add, remove } = useMyRitt();

  const rittData = allArrangements.find((r) => r.id === id);

  usePageTitle(rittData ? `${rittData.name} – Løypevær` : "Fant ikke arrangement – Løypevær");

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [id]);

  // Restore saved planned entry when there are no URL params
  const savedEntry = id ? getPlanned(id) : undefined;

  const initialDate =
    searchParams.get("date") ??
    savedEntry?.date ??
    rittData?.officialDate ??
    "";
  const [selectedDate, setSelectedDate] = useState<string>(initialDate);

  const [startTime, setStartTime] = useState<string>(
    searchParams.get("start") ?? savedEntry?.startTime ?? ""
  );
  const [finishTime, setFinishTime] = useState<string>(
    searchParams.get("finish") ?? savedEntry?.finishTime ?? ""
  );

  // Keep URL in sync with date and timing params
  useEffect(() => {
    const params: Record<string, string> = {};
    if (selectedDate) params.date = selectedDate;
    if (startTime) params.start = startTime;
    if (finishTime) params.finish = finishTime;
    setSearchParams(params, { replace: true });
  }, [selectedDate, startTime, finishTime, setSearchParams]);

  // Auto-save to "mine ritt" whenever date/time changes while the ritt is planned
  useEffect(() => {
    if (id && isPlanned(id)) {
      add(id, { date: selectedDate, startTime, finishTime });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate, startTime, finishTime]);

  const timingActive =
    selectedDate !== "" &&
    startTime !== "" &&
    finishTime !== "";

  const datetimes = timingActive
    ? calcWaypointTimes(selectedDate, startTime, finishTime, [...WAYPOINT_FRACTIONS])
    : null;

  // useWeather shares query keys with WeatherStrip — TanStack Query deduplicates the fetches
  const weatherResults = useWeather(
    rittData ? rittData.waypoints : [],
    selectedDate || null,
    datetimes
  );

  if (!rittData) {
    return (
      <div className="ritt-page ritt-page--not-found">
        <p>Fant ikke arrangement med id «{id}».</p>
        <Link to="../">Tilbake til oversikt</Link>
      </div>
    );
  }

  const planned = id ? isPlanned(id) : false;

  function handleBookmarkToggle() {
    if (!id) return;
    if (planned) {
      remove(id);
    } else {
      add(id, { date: selectedDate, startTime, finishTime });
    }
  }

  const formattedOfficialDate = new Date(rittData.officialDate + "T00:00:00").toLocaleDateString(
    "nb-NO",
    { day: "numeric", month: "long", year: "numeric" }
  );

  const elevationGain = rittData?.elevationGain ?? computeElevationGain(rittData.waypoints);

  // Static difficulty (physical only — no weather)
  const physDifficulty =
    elevationGain != null
      ? scoreToLabel(physicalScore(rittData.distance, elevationGain))
      : null;

  // Weather-adjusted difficulty (only when weather is loaded)
  const hasWeatherData = weatherResults.some((r) => r.data != null);
  const weatherAdj = hasWeatherData
    ? weatherAdjustment(weatherResults, rittData.waypoints)
    : 0;
  const adjDifficulty =
    physDifficulty && hasWeatherData
      ? scoreToLabel(physicalScore(rittData.distance, elevationGain!) + weatherAdj)
      : null;

  return (
    <div className="ritt-page">
      <header className="ritt-page__header">
        <h1>{rittData.name}</h1>
        <div className="ritt-page__meta">
          <span className="ritt-page__meta-item">{rittData.distance} km</span>
          {elevationGain != null && (
            <span className="ritt-page__meta-item ritt-page__meta-item--elevation">
              ↑ {elevationGain} m
            </span>
          )}
          {physDifficulty && (
            <span
              className={`ritt-page__meta-item ritt-page__difficulty-badge ritt-page__difficulty-badge--${physDifficulty.level}`}
            >
              {physDifficulty.label}
            </span>
          )}
          <span className="ritt-page__meta-item">{rittData.region}</span>
          <span className="ritt-page__meta-item">Offisiell dato: {formattedOfficialDate}</span>
          {rittData.url && (
            <a
              href={rittData.url}
              target="_blank"
              rel="noopener noreferrer"
              className="ritt-page__meta-item ritt-page__meta-link"
            >
              Offisiell nettside ↗
            </a>
          )}
          <button
            className={`ritt-page__bookmark-btn${planned ? " ritt-page__bookmark-btn--active" : ""}`}
            onClick={handleBookmarkToggle}
            aria-pressed={planned}
            title={planned ? "Fjern fra mine arrangement" : "Legg til mine arrangement"}
          >
            {planned ? "📌 Mine arrangement" : "📍 Legg til mine arrangement"}
          </button>
          <ShareButton />
        </div>
      </header>

      <section className="ritt-page__map-section">
        <RittMap waypoints={rittData.waypoints} name={rittData.name} discipline={rittData.discipline} />
      </section>

      <section className="ritt-page__elevation-section">
        <ElevationProfile waypoints={rittData.waypoints} distanceKm={rittData.distance} />
      </section>

      <section className="ritt-page__date-section">
        <DatePicker
          value={selectedDate}
          onChange={setSelectedDate}
          officialDate={rittData.officialDate}
        />
        <TimePicker
          startTime={startTime}
          finishTime={finishTime}
          onStartChange={setStartTime}
          onFinishChange={setFinishTime}
          onClear={() => {
            setStartTime("");
            setFinishTime("");
          }}
          distanceKm={rittData.distance}
          officialStartTime={rittData.officialStartTime}
        />
      </section>

      <section className="ritt-page__weather-section">
        <ErrorBoundary
          fallback={
            <p className="error-boundary__message">
              Kunne ikke laste værmeldingen. Sjekk nettverkstilkoblingen og prøv igjen.
            </p>
          }
        >
          <WeatherStrip
            waypoints={rittData.waypoints}
            date={selectedDate || null}
            startTime={startTime || null}
            finishTime={finishTime || null}
          />
          {selectedDate && (
            <>
              {adjDifficulty && physDifficulty && (
                <div className="dag-vurdering">
                  <span className="dag-vurdering__label">Dag-vurdering:</span>
                  {adjDifficulty.level !== physDifficulty.level ? (
                    <>
                      <span className={`dag-vurdering__badge dag-vurdering__badge--${physDifficulty.level}`}>
                        {physDifficulty.label}
                      </span>
                      <span className="dag-vurdering__arrow">→</span>
                      <span className={`dag-vurdering__badge dag-vurdering__badge--${adjDifficulty.level}`}>
                        {adjDifficulty.label}
                      </span>
                      <span className="dag-vurdering__note">pga. vær</span>
                    </>
                  ) : (
                    <span className={`dag-vurdering__badge dag-vurdering__badge--${adjDifficulty.level}`}>
                      {adjDifficulty.label}
                    </span>
                  )}
                </div>
              )}
              <GearSuggestion
                results={weatherResults}
                waypoints={rittData.waypoints}
              />
            </>
          )}
        </ErrorBoundary>
      </section>

      <section className="ritt-page__history-section">
        <HistoricalWeatherTable
          waypoints={rittData.waypoints}
          officialDate={rittData.officialDate}
        />
      </section>
    </div>
  );
}
