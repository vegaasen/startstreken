import { useParams, useSearchParams, Link } from "react-router-dom";
import { useState, useEffect, useRef } from "react";
import { Helmet } from "react-helmet-async";
import { DatePicker } from "../components/DatePicker";
import { TimePicker } from "../components/TimePicker";
import { WeatherStrip } from "../components/WeatherStrip";
import { EventMap } from "../components/EventMap";
import { HistoricalWeatherTable } from "../components/HistoricalWeatherTable";
import { GearSuggestion } from "../components/GearSuggestion";
import { ElevationProfile } from "../components/ElevationProfile";
import { ErrorBoundary } from "../components/ErrorBoundary";
import { computeElevationGain, allArrangements } from "../lib/ritt";
import { physicalScore, weatherAdjustment, scoreToLabel } from "../lib/difficulty";
import { SITE_URL, disciplineToSport } from "../lib/seo";
import { useMyEvents } from "../hooks/useMyEvents";
import { useWeather } from "../hooks/useWeather";
import { calcWaypointTimes, WAYPOINT_FRACTIONS } from "../lib/timing";
import { ShareButton } from "../components/ShareButton";

export function EventPage() {
  const { id } = useParams<{ id: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const { isPlanned, getPlanned, add, remove } = useMyEvents();

  // Keep a ref to always call the latest add/isPlanned without re-triggering the auto-save effect
  const addRef = useRef(add);
  const isPlannedRef = useRef(isPlanned);
  useEffect(() => { addRef.current = add; }, [add]);
  useEffect(() => { isPlannedRef.current = isPlanned; }, [isPlanned]);

  const rittData = allArrangements.find((r) => r.id === id);

  const pageUrl = rittData ? `${SITE_URL}/arrangement/${rittData.id}` : SITE_URL;
  const pageTitle = rittData
    ? `${rittData.name} – Løypevær`
    : "Fant ikke arrangement – Løypevær";
  const rittYear = rittData
    ? new Date(rittData.officialDate + "T00:00:00").getFullYear()
    : null;
  const pageDescription = rittData
    ? `Vær og klimasnitt for ${rittData.name} ${rittYear} – ${rittData.distanceLabel ?? `${rittData.distance} km`}, ${rittData.elevationGain} hm i ${rittData.region}. Sjekk temperatur, vind og nedbør for hvert punkt langs løypa.`
    : undefined;

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
    if (id && isPlannedRef.current(id)) {
      addRef.current(id, { date: selectedDate, startTime, finishTime });
    }
  }, [selectedDate, startTime, finishTime, id]);

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
      <Helmet>
        <title>{pageTitle}</title>
        {pageDescription && <meta name="description" content={pageDescription} />}
        <link rel="canonical" href={pageUrl} />
        <meta property="og:type" content="website" />
        <meta property="og:url" content={pageUrl} />
        <meta property="og:title" content={pageTitle} />
        {pageDescription && <meta property="og:description" content={pageDescription} />}
        <meta property="og:locale" content="nb_NO" />
        <meta name="twitter:card" content="summary" />
        <meta name="twitter:title" content={pageTitle} />
        {pageDescription && <meta name="twitter:description" content={pageDescription} />}
        <script type="application/ld+json">
          {JSON.stringify({
            "@context": "https://schema.org",
            "@type": "SportsEvent",
            name: rittData.name,
            startDate: rittData.officialDate,
            description: pageDescription,
            url: pageUrl,
            sport: disciplineToSport(rittData.discipline),
            location: {
              "@type": "Place",
              name: rittData.region,
              geo: {
                "@type": "GeoCoordinates",
                latitude: rittData.waypoints[0].lat,
                longitude: rittData.waypoints[0].lon,
              },
            },
            ...(rittData.url ? { sameAs: rittData.url } : {}),
          })}
        </script>
      </Helmet>
      <Link to="/" className="ritt-page__back-link">← Alle arrangement</Link>
      <header className="ritt-page__header">
        <h1>{rittData.name}</h1>
        <div className="ritt-page__meta">
          <span className="ritt-page__meta-item">
            {rittData.distanceLabel ?? `${rittData.distance} km`}
          </span>
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
          {rittData.dateStatus === "pending" && (
            <span className="ritt-page__meta-item ritt-page__pending-badge" title="Datoen er ikke offisielt bekreftet ennå">
              Tentativ dato
            </span>
          )}
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
        <EventMap waypoints={rittData.waypoints} name={rittData.name} discipline={rittData.discipline} />
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
            externalResults={weatherResults}
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
