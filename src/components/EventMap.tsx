import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { Waypoint } from "../lib/weather";
import type { Discipline } from "../lib/arrangements";

type Props = {
  waypoints: Waypoint[];
  name: string;
  discipline: Discipline;
};

type OsrmRoute = {
  geometry: {
    coordinates: [number, number][];
  };
};

/** Maps discipline to the best available OSRM routing profile. */
function osrmProfile(discipline: Discipline): string {
  switch (discipline) {
    case "landevei":
      return "bike"; // road cycling — bike profile is closest
    case "terreng":
      return "bike"; // MTB — bike profile
    case "langrenn":
    case "ultraløp":
    case "løping":
      return "foot"; // ski/running use pedestrian/foot routing
    case "triathlon":
      return "foot"; // mixed; foot is safest fallback for swim/run legs
  }
}

async function fetchOsrmRoute(waypoints: Waypoint[], discipline: Discipline): Promise<[number, number][]> {
  // OSRM expects lon,lat pairs
  const coords = waypoints.map((w) => `${w.lon},${w.lat}`).join(";");
  const profile = osrmProfile(discipline);
  const url = `https://router.project-osrm.org/route/v1/${profile}/${coords}?overview=full&geometries=geojson`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`OSRM error: ${res.status}`);
  const json = await res.json() as { routes?: OsrmRoute[] };
  const route = json.routes?.[0];
  if (!route) throw new Error("No route returned");
  // GeoJSON coords are [lon, lat] — flip to [lat, lon] for Leaflet
  return route.geometry.coordinates.map(([lon, lat]) => [lat, lon]);
}

export function EventMap({ waypoints, name, discipline }: Props) {
  const mapRef = useRef<HTMLDivElement>(null);
  const detailsRef = useRef<HTMLDetailsElement>(null);
  // Keep a ref to the Leaflet map instance so we can destroy it on unmount
  // We import Leaflet dynamically to avoid SSR issues and because it needs the DOM
  const leafletMapRef = useRef<import("leaflet").Map | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  // Use the toggle event (fires after browser commits open state) instead of
  // inferring next state from onClick — avoids off-by-one on rapid clicks.
  useEffect(() => {
    const el = detailsRef.current;
    if (!el) return;
    const handler = () => setIsOpen(el.open);
    el.addEventListener("toggle", handler);
    return () => el.removeEventListener("toggle", handler);
  }, []);

  const { data: routeCoords, isError: routeError } = useQuery({
    queryKey: ["osrm-route", waypoints.map((w) => `${w.lat},${w.lon}`).join("|"), discipline],
    queryFn: () => fetchOsrmRoute(waypoints, discipline),
    staleTime: Infinity,
    retry: 1,
    enabled: isOpen,
  });

  // Straight-line fallback: [lat, lon] pairs
  const fallbackCoords: [number, number][] = waypoints.map((w) => [w.lat, w.lon]);
  const polylineCoords = routeCoords ?? (routeError ? fallbackCoords : null);

  useEffect(() => {
    if (!isOpen || !mapRef.current || !polylineCoords) return;

    // Dynamic import so Leaflet CSS can be imported alongside
    void import("leaflet").then((L) => {
      // Destroy previous instance if re-mounting
      if (leafletMapRef.current) {
        leafletMapRef.current.remove();
        leafletMapRef.current = null;
      }

      // Calculate bounds from waypoints
      const bounds = L.latLngBounds(waypoints.map((w) => [w.lat, w.lon]));

      const map = L.map(mapRef.current!, {
        scrollWheelZoom: false,
        attributionControl: true,
      });
      leafletMapRef.current = map;

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 18,
      }).addTo(map);

      // Draw route polyline
      L.polyline(polylineCoords, {
        color: "var(--accent, #aa3bff)",
        weight: 3,
        opacity: 0.85,
      }).addTo(map);

      // Waypoint markers
      waypoints.forEach((wp, i) => {
        const isStart = i === 0;
        const isFinish = i === waypoints.length - 1;
        const color = isStart ? "#22c55e" : isFinish ? "#ef4444" : "var(--accent, #aa3bff)";

        const icon = L.divIcon({
          className: "ritt-map__marker",
          html: `<div class="ritt-map__marker-dot" style="background:${color}"></div>`,
          iconSize: [14, 14],
          iconAnchor: [7, 7],
        });

        const altText = wp.altitude != null ? ` (${wp.altitude} m o.h.)` : "";
        L.marker([wp.lat, wp.lon], { icon })
          .addTo(map)
          .bindTooltip(`${wp.label}${altText}`, {
            permanent: false,
            direction: "top",
            offset: [0, -10],
          });
      });

      map.fitBounds(bounds, { padding: [32, 32] });
    });

    return () => {
      if (leafletMapRef.current) {
        leafletMapRef.current.remove();
        leafletMapRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, polylineCoords]);

  return (
    <details ref={detailsRef} className="ritt-map__details">
      <summary className="ritt-map__summary">
        Kart over ruten — {name}
        {routeError && (
          <span className="ritt-map__fallback-note"> (rett-linje)</span>
        )}
      </summary>
      <div className="ritt-map__container" ref={mapRef} />
    </details>
  );
}
