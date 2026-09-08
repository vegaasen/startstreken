import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { AlertsOptIn } from "../components/AlertsOptIn";
import { DatePicker } from "../components/DatePicker";
import { ErrorBoundary } from "../components/ErrorBoundary";
import { FeedbackSnackbar } from "../components/FeedbackSnackbar";
import { GearSuggestion } from "../components/GearSuggestion";
import { PageMeta } from "../components/PageMeta";
import { RaceDayCountdown } from "../components/RaceDayCountdown";
import { ShareButton } from "../components/ShareButton";
import { TimePicker } from "../components/TimePicker";
import { WeatherStrip } from "../components/WeatherStrip";
import { useMyEvents } from "../hooks/useMyEvents";
import { useWeather } from "../hooks/useWeather";
import { trackExternalLinkClick, trackRaceSelected, trackWaypointSelected } from "../lib/analytics";
import { allArrangements, computeElevationGain } from "../lib/arrangements";
import { buildClimateNarrative } from "../lib/climateNarrative";
import { formatNorwegianDate, parseDateLocal } from "../lib/dates";
import { physicalScore, scoreToLabel, weatherAdjustment } from "../lib/difficulty";
import { buildOgDescription, getOgImagePath } from "../lib/og";
import { disciplineKeywords, disciplineToSport, disciplineVerb, SITE_URL } from "../lib/seo";
import { calcWaypointTimes } from "../lib/timing";
import { getWeatherCache, isForecastRange } from "../lib/weather";

const EventMap = lazy(() =>
  import("../components/EventMap").then((m) => ({ default: m.EventMap })),
);
const HistoricalWeatherTable = lazy(() =>
  import("../components/HistoricalWeatherTable").then((m) => ({
    default: m.HistoricalWeatherTable,
  })),
);
const ElevationProfile = lazy(() =>
  import("../components/ElevationProfile").then((m) => ({ default: m.ElevationProfile })),
);

/** Fractions of race duration at which to show live weather for single-point (løping) events. */
const RUNNING_PROGRESS_FRACTIONS = [0.2, 0.4, 0.6, 0.8, 1.0];

export function EventPage() {
  const { id } = useParams<{ id: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const { isPlanned, getPlanned, add, remove } = useMyEvents();

  // Keep a ref to always call the latest add/isPlanned without re-triggering the auto-save effect
  const addRef = useRef(add);
  const isPlannedRef = useRef(isPlanned);
  useEffect(() => {
    addRef.current = add;
  }, [add]);
  useEffect(() => {
    isPlannedRef.current = isPlanned;
  }, [isPlanned]);

  const rittData = allArrangements.find((r) => r.id === id);

  const pageUrl = rittData ? `${SITE_URL}/arrangement/${rittData.id}` : SITE_URL;
  const rittYear = rittData ? parseDateLocal(rittData.officialDate).getFullYear() : null;
  const pageTitle = rittData
    ? `Vær for ${rittData.name} ${rittYear ?? ""} – løypevær, temperatur og vind | Løypevær`
    : "Fant ikke arrangement – Løypevær";
  const [climateNarrative, setClimateNarrative] = useState<string | null>(null);

  useEffect(() => {
    if (!rittData) return;
    void getWeatherCache().then((cache) => {
      setClimateNarrative(buildClimateNarrative(rittData, cache));
    });
  }, [rittData?.id, rittData]); // eslint-disable-line react-hooks/exhaustive-deps

  const pageDescription = rittData
    ? [
        `Skal du ${disciplineVerb(rittData.discipline)} ${rittData.name} ${rittYear ?? ""}?`,
        climateNarrative,
        `Sjekk timebasert værmelding og historiske klimasnitt for alle veipunkter langs løypa – temperatur, vind og nedbør for ${rittData.distanceLabel ?? `${rittData.distance} km`}${rittData.elevationGain ? ` og ${rittData.elevationGain} hm` : ""} i ${rittData.region}.`,
      ]
        .filter(Boolean)
        .join(" ")
    : undefined;

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  useEffect(() => {
    if (!rittData) return;
    trackRaceSelected(rittData.id, rittData.name, rittData.discipline);
  }, [rittData?.id, rittData?.name, rittData?.discipline, rittData]);

  // Restore saved planned entry when there are no URL params
  const savedEntry = id ? getPlanned(id) : undefined;

  const initialDate = searchParams.get("date") ?? savedEntry?.date ?? rittData?.officialDate ?? "";
  const [selectedDate, setSelectedDate] = useState<string>(initialDate);

  const [startTime, setStartTime] = useState<string>(
    searchParams.get("start") ?? savedEntry?.startTime ?? "",
  );
  const [finishTime, setFinishTime] = useState<string>(
    searchParams.get("finish") ?? savedEntry?.finishTime ?? "",
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

  const timingActive = selectedDate !== "" && startTime !== "" && finishTime !== "";

  // Running events are single-point loop courses (no route to spread waypoints
  // along), so instead we show live weather at 20/40/60/80/100% of expected
  // race duration, all at the same location.
  const isSingleLocationRunning =
    rittData?.discipline === "løping" && rittData.waypoints.length === 1;

  // Shown even before a start/finish time is picked, faded, as a preview of
  // the per-point breakdown that appears once timing is set.
  const weatherWaypoints = isSingleLocationRunning
    ? RUNNING_PROGRESS_FRACTIONS.map((f) => ({
        ...rittData!.waypoints[0],
        label: `${Math.round(f * 100)} % av løpet`,
      }))
    : (rittData?.waypoints ?? []);

  const waypointCount = weatherWaypoints.length || 5;
  const dynamicFractions = isSingleLocationRunning
    ? RUNNING_PROGRESS_FRACTIONS
    : Array.from({ length: waypointCount }, (_, i) =>
        waypointCount === 1 ? 0 : i / (waypointCount - 1),
      );

  const datetimes = timingActive
    ? calcWaypointTimes(selectedDate, startTime, finishTime, dynamicFractions)
    : null;

  // useWeather shares query keys with WeatherStrip — TanStack Query deduplicates the fetches
  const weatherResults = useWeather(weatherWaypoints, selectedDate || null, datetimes);

  // Dynamic og values — for the single-location running strip all entries share
  // the same weather, so only the first is useful in the summary line.
  const ogDescription =
    buildOgDescription(isSingleLocationRunning ? weatherResults.slice(0, 1) : weatherResults) ??
    (rittData ? `${rittData.name} – værmeldingen langs løypa` : "Løypevær");

  const ogImage = rittData
    ? `${SITE_URL}${getOgImagePath(rittData.discipline, import.meta.env.BASE_URL)}`
    : undefined;

  const shareUrl = useMemo(() => {
    const url = new URL(window.location.href);
    if (selectedDate) {
      url.searchParams.set("date", selectedDate);
    } else {
      url.searchParams.delete("date");
    }
    if (startTime) {
      url.searchParams.set("start", startTime);
    } else {
      url.searchParams.delete("start");
    }
    if (finishTime) {
      url.searchParams.set("finish", finishTime);
    } else {
      url.searchParams.delete("finish");
    }
    return url.toString();
  }, [selectedDate, startTime, finishTime]);

  if (!rittData) {
    return (
      <div className="status-page">
        <div className="status-card">
          <h1 className="status-card__title">Arrangement ikke funnet</h1>
          <p className="status-card__body">
            Fant ikke arrangement med id <em>{id}</em>. Det kan ha blitt fjernet eller endret.
          </p>
          <div className="status-card__actions">
            <Link to="/" className="status-card__btn">
              ← Alle arrangement
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (rittData.waypoints.length === 0) {
    const isCancelled = rittData.dateStatus === "cancelled";
    return (
      <>
        <PageMeta
          title={pageTitle}
          description={pageDescription ?? `${rittData.name} – Løypevær`}
          canonicalUrl={pageUrl}
        />
        <div className="status-page">
          <div className="status-card">
            <h1 className="status-card__title">{rittData.name}</h1>
            <p className="status-card__body">
              {rittData.distanceLabel ?? `${rittData.distance} km`}
              {rittData.region ? ` · ${rittData.region}` : ""}
              {" · "}
              {formatNorwegianDate(rittData.officialDate)}
            </p>
            {isCancelled && <p className="status-card__notice">Dette arrangementet er avlyst.</p>}
            {rittData.url && (
              <a
                href={rittData.url}
                target="_blank"
                rel="noopener noreferrer"
                className="status-card__link"
              >
                Nettside ↗
              </a>
            )}
            <p className="status-card__notice">
              Rutedata er ikke tilgjengelig ennå – kart, høydeprofil og værvarsler vises når løypa
              er lagt inn.
            </p>
            <div className="status-card__actions">
              <Link to="/" className="status-card__btn">
                ← Alle arrangement
              </Link>
            </div>
          </div>
        </div>
      </>
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

  const formattedOfficialDate = formatNorwegianDate(rittData.officialDate);

  const elevationGain = rittData?.elevationGain ?? computeElevationGain(rittData.waypoints);

  // Static difficulty (physical only — no weather)
  const physDifficulty =
    elevationGain != null ? scoreToLabel(physicalScore(rittData.distance, elevationGain)) : null;

  // Weather-adjusted difficulty (only when weather is loaded)
  const hasWeatherData = weatherResults.some((r) => r.data != null);
  const weatherAdj = hasWeatherData ? weatherAdjustment(weatherResults, rittData.waypoints) : 0;
  const adjDifficulty =
    physDifficulty && hasWeatherData
      ? scoreToLabel(physicalScore(rittData.distance, elevationGain!) + weatherAdj)
      : null;

  const forecastOnly = rittData?.discipline === "løping";

  return (
    <div className="ritt-page">
      <PageMeta
        title={pageTitle}
        description={ogDescription}
        canonicalUrl={pageUrl}
        ogType="website"
        ogImage={ogImage}
      />
      <Helmet>
        {rittData && (
          <meta
            name="keywords"
            content={`${rittData.name.toLowerCase()}, ${rittData.name.toLowerCase()} vær, ${disciplineKeywords(rittData.discipline)}, værmelding ${rittData.region.toLowerCase()}`}
          />
        )}
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
              ...(rittData.waypoints.length > 0
                ? {
                    geo: {
                      "@type": "GeoCoordinates",
                      latitude: rittData.waypoints[0].lat,
                      longitude: rittData.waypoints[0].lon,
                    },
                  }
                : {}),
            },
            ...(rittData.url ? { sameAs: rittData.url } : {}),
          })}
        </script>
      </Helmet>
      <header className="ritt-page__header">
        <div className="ritt-page__title-row">
          <h1>{rittData.name}</h1>
        </div>
        <div className="ritt-page__stats-row">
          <span>{rittData.distanceLabel ?? `${rittData.distance} km`}</span>
          {elevationGain != null && (
            <span className="ritt-page__stats-elevation">· ↑ {elevationGain} m</span>
          )}
          <span>· {rittData.region}</span>
          <span className="ritt-page__actions-date">
            · {formattedOfficialDate}
            {rittData.dateStatus === "pending" && (
              <span
                className="ritt-page__pending-badge"
                title="Datoen er ikke offisielt bekreftet ennå"
              >
                Tentativ
              </span>
            )}
          </span>
          {rittData.url && (
            <a
              href={rittData.url}
              target="_blank"
              rel="noopener noreferrer"
              className="ritt-page__meta-link"
              onClick={() => trackExternalLinkClick(rittData.url!, rittData.name)}
            >
              · Nettside ↗
            </a>
          )}
        </div>
        <div className="ritt-page__actions-row">
          <button
            className={`ritt-page__bookmark-btn${planned ? " ritt-page__bookmark-btn--active" : ""}`}
            onClick={handleBookmarkToggle}
            aria-pressed={planned}
            title={planned ? "Fjern fra mine arrangement" : "Legg til mine arrangement"}
          >
            {planned ? "📌 Mine arrangement" : "📍 Legg til mine arrangement"}
          </button>
          <ShareButton url={shareUrl} label={startTime && finishTime ? "Del (med tid)" : "Del"} />
        </div>
        {planned && <AlertsOptIn eventId={rittData.id} />}
      </header>

      {/* ── Date & time pickers ── */}
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
          discipline={rittData.discipline}
        />
      </section>

      {/* ── Weather ── */}
      <section className="ritt-page__weather-section">
        <ErrorBoundary
          fallback={
            <p className="error-boundary__message">
              Kunne ikke laste værmeldingen. Sjekk nettverkstilkoblingen og prøv igjen.
            </p>
          }
        >
          {forecastOnly && selectedDate && !isForecastRange(selectedDate) ? (
            <p className="ritt-page__forecast-only-note">
              Værmeldingen er ikke klar ennå — sjekk igjen nærmere løpsdagen.
            </p>
          ) : (
            <>
              <RaceDayCountdown
                selectedDate={selectedDate}
                startWaypointWeather={weatherResults[0]?.data ?? null}
              />
              <WeatherStrip
                waypoints={weatherWaypoints}
                date={selectedDate || null}
                startTime={startTime || null}
                finishTime={finishTime || null}
                externalResults={weatherResults}
                onWaypointClick={(wp, i) => trackWaypointSelected(rittData.id, wp.label, i)}
                totalDistanceKm={isSingleLocationRunning ? undefined : rittData.distance}
                fractions={dynamicFractions}
                forecastOnly={forecastOnly}
                sameLocation={isSingleLocationRunning}
                placeholder={isSingleLocationRunning && !timingActive}
              />
            </>
          )}
          {!forecastOnly && selectedDate && adjDifficulty && physDifficulty && (
            <div className="dag-vurdering">
              {adjDifficulty.level !== physDifficulty.level ? (
                <>
                  <span className="dag-vurdering__label">Dag-vurdering:</span>
                  <span
                    className={`dag-vurdering__badge dag-vurdering__badge--${physDifficulty.level}`}
                  >
                    {physDifficulty.label}
                  </span>
                  <span className="dag-vurdering__arrow">→</span>
                  <span
                    className={`dag-vurdering__badge dag-vurdering__badge--${adjDifficulty.level}`}
                  >
                    {adjDifficulty.label}
                  </span>
                  <span className="dag-vurdering__note">(pga. vær)</span>
                </>
              ) : (
                <>
                  <span className="dag-vurdering__label">Dag-vurdering:</span>
                  <span
                    className={`dag-vurdering__badge dag-vurdering__badge--${adjDifficulty.level}`}
                  >
                    {adjDifficulty.label}
                  </span>
                </>
              )}
            </div>
          )}
        </ErrorBoundary>
      </section>

      {/* ── Secondary sections — grouped collapsible accordion ── */}
      <div className="ritt-page__secondary-sections">
        {!forecastOnly && (
          <ErrorBoundary
            fallback={<p className="error-boundary__message">Kunne ikke laste høydeprofilen.</p>}
          >
            <Suspense fallback={<div className="ritt-page__section-skeleton" aria-hidden />}>
              <ElevationProfile waypoints={rittData.waypoints} distanceKm={rittData.distance} />
            </Suspense>
          </ErrorBoundary>
        )}
        {!forecastOnly && selectedDate && (
          <GearSuggestion
            results={weatherResults}
            waypoints={rittData.waypoints}
            discipline={rittData.discipline}
          />
        )}
        {!forecastOnly && (
          <ErrorBoundary
            fallback={<p className="error-boundary__message">Kunne ikke laste historiske data.</p>}
          >
            <Suspense fallback={<div className="ritt-page__section-skeleton" aria-hidden />}>
              <HistoricalWeatherTable
                waypoints={rittData.waypoints}
                officialDate={rittData.officialDate}
              />
            </Suspense>
          </ErrorBoundary>
        )}
        <ErrorBoundary
          fallback={<p className="error-boundary__message">Kunne ikke laste kartet.</p>}
        >
          <Suspense fallback={<div className="ritt-page__section-skeleton" aria-hidden />}>
            <EventMap
              waypoints={rittData.waypoints}
              name={rittData.name}
              discipline={rittData.discipline}
            />
          </Suspense>
        </ErrorBoundary>
      </div>
      <FeedbackSnackbar eventId={id ?? ""} />
    </div>
  );
}
