import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { Waypoint } from "../lib/weather";

type Props = {
  waypoints: Waypoint[];
  name: string;
};

type OsrmRoute = {
  geometry: {
    coordinates: [number, number][];
  };
};

async function fetchOsrmRoute(waypoints: Waypoint[]): Promise<[number, number][]> {
  // OSRM expects lon,lat pairs
  const coords = waypoints.map((w) => `${w.lon},${w.lat}`).join(";");
  const url = `https://router.project-osrm.org/route/v1/bike/${coords}?overview=full&geometries=geojson`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`OSRM error: ${res.status}`);
  const json = await res.json();
  const route: OsrmRoute = json.routes?.[0];
  if (!route) throw new Error("No route returned");
  // GeoJSON coords are [lon, lat] — flip to [lat, lon] for Leaflet
  return route.geometry.coordinates.map(([lon, lat]) => [lat, lon]);
}

export function RittMap({ waypoints, name }: Props) {
  const mapRef = useRef<HTMLDivElement>(null);
  // Keep a ref to the Leaflet map instance so we can destroy it on unmount
  // We import Leaflet dynamically to avoid SSR issues and because it needs the DOM
  const leafletMapRef = useRef<import("leaflet").Map | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  const { data: routeCoords, isError: routeError } = useQuery({
    queryKey: ["osrm-route", waypoints.map((w) => `${w.lat},${w.lon}`).join("|")],
    queryFn: () => fetchOsrmRoute(waypoints),
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
    import("leaflet").then((L) => {
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

  function handleToggle(e: React.MouseEvent<HTMLElement>) {
    // <details> toggles natively; we track state to trigger map init
    const details = e.currentTarget.closest("details");
    if (details) {
      // The toggle hasn't happened yet when onClick fires on <summary>,
      // so we check the current open attr and flip it
      setIsOpen(!details.open);
    }
  }

  return (
    <details className="ritt-map__details">
      <summary className="ritt-map__summary" onClick={handleToggle}>
        Kart over ruten — {name}
        {routeError && (
          <span className="ritt-map__fallback-note"> (rett-linje)</span>
        )}
      </summary>
      <div className="ritt-map__container" ref={mapRef} />
    </details>
  );
}
