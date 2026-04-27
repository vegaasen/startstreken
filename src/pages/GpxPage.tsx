import { useState, useCallback, useRef } from "react";
import { Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { WeatherStrip } from "../components/WeatherStrip";
import { EventMap } from "../components/EventMap";
import { ElevationProfile } from "../components/ElevationProfile";
import { TimePicker } from "../components/TimePicker";
import { ErrorBoundary } from "../components/ErrorBoundary";
import {
  parseGpx,
  downsampleGpx,
  gpxTotalDistanceKm,
  fetchGpxFromUrl,
  type GpxTrackPoint,
} from "../lib/gpx";
import { computeElevationGain } from "../lib/ritt";
import type { Waypoint } from "../lib/weather";

const TODAY = new Date().toISOString().slice(0, 10);
const DEFAULT_WAYPOINT_COUNT = 8;

interface ParsedRoute {
  waypoints: Waypoint[];
  distanceKm: number;
  elevationGain: number | null;
  name: string;
}

function buildRoute(points: GpxTrackPoint[], name: string, count: number): ParsedRoute {
  const waypoints = downsampleGpx(points, count);
  const distanceKm = gpxTotalDistanceKm(points);
  const elevationGain = computeElevationGain(waypoints);
  return { waypoints, distanceKm, elevationGain, name };
}

export function GpxPage() {
  const [route, setRoute] = useState<ParsedRoute | null>(null);
  const [rawPoints, setRawPoints] = useState<GpxTrackPoint[] | null>(null);
  const [rawName, setRawName] = useState<string>("");
  const [waypointCount, setWaypointCount] = useState<number>(DEFAULT_WAYPOINT_COUNT);

  const [selectedDate, setSelectedDate] = useState<string>(TODAY);
  const [startTime, setStartTime] = useState<string>("");
  const [finishTime, setFinishTime] = useState<string>("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [urlInput, setUrlInput] = useState<string>("");

  const fileInputRef = useRef<HTMLInputElement>(null);

  function applyPoints(points: GpxTrackPoint[], name: string, count: number) {
    setRawPoints(points);
    setRawName(name);
    setRoute(buildRoute(points, name, count));
    setError(null);
  }

  const handleFile = useCallback((file: File) => {
    if (!file.name.toLowerCase().endsWith(".gpx")) {
      setError("Kun .gpx-filer støttes.");
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const points = parseGpx(text);
        const name = file.name.replace(/\.gpx$/i, "");
        applyPoints(points, name, waypointCount);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Ukjent feil ved parsing av GPX.");
      }
    };
    reader.readAsText(file);
  }, [waypointCount]);

  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  }

  async function handleUrlLoad() {
    if (!urlInput.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const points = await fetchGpxFromUrl(urlInput.trim());
      const name = urlInput.split("/").pop()?.replace(/\.gpx$/i, "") ?? "GPX-løype";
      applyPoints(points, name, waypointCount);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ukjent feil ved nedlasting av GPX.");
    } finally {
      setLoading(false);
    }
  }

  function handleWaypointCountChange(count: number) {
    setWaypointCount(count);
    if (rawPoints) {
      setRoute(buildRoute(rawPoints, rawName, count));
    }
  }

  function handleReset() {
    setRoute(null);
    setRawPoints(null);
    setRawName("");
    setError(null);
    setUrlInput("");
    setStartTime("");
    setFinishTime("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  return (
    <div className="ritt-page">
      <Helmet>
        <title>Værvarsеl for din løype – Løypevær</title>
        <meta name="description" content="Last opp ruten din og få værvarsеl langs hele løypa — fra start til mål." />
      </Helmet>

      <Link to="/" className="ritt-page__back-link">← Alle arrangement</Link>

      <header className="ritt-page__header">
        <h1>Værvarsеl for din løype</h1>
        <p className="ritt-page__subtitle">
          Last opp ruten din og se værvarselet langs veien — fra start til mål.
        </p>
      </header>

      {!route && (
        <section className="gpx-upload">
          <div
            className="gpx-upload__dropzone"
            onDrop={handleDrop}
            onDragOver={(e) => e.preventDefault()}
            onClick={() => fileInputRef.current?.click()}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") fileInputRef.current?.click(); }}
            aria-label="Last opp GPX-fil"
          >
            <svg className="gpx-upload__icon" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 16V4m0 0L8 8m4-4 4 4" />
              <path d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2" />
            </svg>
            <p className="gpx-upload__primary">Dra og slipp ruten din her</p>
            <p className="gpx-upload__secondary">(.gpx-fil — klikk for å velge)</p>
            <input
              ref={fileInputRef}
              type="file"
              accept=".gpx"
              className="gpx-upload__file-input"
              onChange={handleFileInput}
              aria-hidden="true"
              tabIndex={-1}
            />
          </div>
          <p>eller</p>
          <div className="gpx-upload__url-row">
            <input
              type="url"
              className="gpx-upload__url-input"
              placeholder="Lim inn URL til GPX…"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") void handleUrlLoad(); }}
              aria-label="URL til GPX-fil"
            />
            <button
                className="gpx-upload__url-btn"
                onClick={() => void handleUrlLoad()}
                disabled={loading || !urlInput.trim()}
            >
              {loading ? "Laster…" : "Last inn"}
            </button>
          </div>
          <p className="gpx-upload__hint">
            Eksporter GPX fra <span>Strava</span>, <span>Garmin Connect</span>, <span>Komoot</span> eller lignende
          </p>

          {error && <p className="gpx-upload__error" role="alert">{error}</p>}
        </section>
      )}

      {route && (
        <>
          <div className="gpx-route-meta">
            <span className="ritt-page__meta-item">{route.name}</span>
            <span className="ritt-page__meta-item">{route.distanceKm} km</span>
            {route.elevationGain != null && (
              <span className="ritt-page__meta-item ritt-page__meta-item--elevation">
                ↑ {route.elevationGain} m
              </span>
            )}
            <span className="ritt-page__meta-item">
              {route.waypoints.length} målepunkter
            </span>
            <button className="gpx-route-meta__reset" onClick={handleReset}>
              Last inn ny GPX
            </button>
          </div>

          <div className="gpx-waypoint-count">
            <label htmlFor="gpx-wpt-count" className="gpx-waypoint-count__label">
              Antall målepunkter:
            </label>
            <input
              id="gpx-wpt-count"
              type="range"
              min={3}
              max={15}
              value={waypointCount}
              onChange={(e) => handleWaypointCountChange(Number(e.target.value))}
              className="gpx-waypoint-count__slider"
              aria-label={`${waypointCount} målepunkter`}
            />
            <span className="gpx-waypoint-count__value">{waypointCount}</span>
          </div>

          <section className="ritt-page__map-section">
            <EventMap waypoints={route.waypoints} name={route.name} discipline="landevei" />
          </section>

          <section className="ritt-page__elevation-section">
            <ElevationProfile waypoints={route.waypoints} distanceKm={route.distanceKm} />
          </section>

          <section className="ritt-page__date-section">
            <div className="date-picker">
              <label htmlFor="gpx-date" className="date-picker__label">Velg dato</label>
              <div className="date-picker__controls">
                <input
                  id="gpx-date"
                  type="date"
                  className="date-picker__input"
                  value={selectedDate}
                  min="2000-01-01"
                  onChange={(e) => setSelectedDate(e.target.value)}
                />
              </div>
            </div>
            <TimePicker
              startTime={startTime}
              finishTime={finishTime}
              onStartChange={setStartTime}
              onFinishChange={setFinishTime}
              onClear={() => { setStartTime(""); setFinishTime(""); }}
              distanceKm={route.distanceKm}
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
                waypoints={route.waypoints}
                date={selectedDate || null}
                startTime={startTime || null}
                finishTime={finishTime || null}
              />
            </ErrorBoundary>
          </section>
        </>
      )}
    </div>
  );
}
