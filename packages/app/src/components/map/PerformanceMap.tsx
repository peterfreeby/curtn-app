"use client";

import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet.markercluster";
import "leaflet.markercluster/dist/MarkerCluster.css";

interface Performance {
  id: string;
  date: string;
  time: string;
  venue: {
    id: string;
    name: string;
    slug: string;
    city: string;
    coordinates: { lat: number; lng: number };
  } | null;
  ticketUrl: string | null;
  soldOut: boolean | string | null;
  run: {
    id: string;
    show: {
      id: string;
      title: string;
      posterUrl: string | null;
      performanceTypes: string[];
    };
    productionCompany: { name: string } | null;
  } | null;
}

interface MapBounds {
  swLat: number; swLng: number; neLat: number; neLng: number;
}

interface PerformanceMapProps {
  performances: Performance[];
  className?: string;
  onBoundsChange?: (bounds: MapBounds) => void;
}

function groupByVenue(performances: Performance[]) {
  const groups = new Map<string, { venue: Performance["venue"]; performances: Performance[] }>();
  for (const perf of performances) {
    if (!perf.venue?.coordinates) continue;
    const key = perf.venue.id;
    if (!groups.has(key)) {
      groups.set(key, { venue: perf.venue, performances: [] });
    }
    groups.get(key)!.performances.push(perf);
  }
  return Array.from(groups.values());
}

function esc(str: string): string {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// Build popup HTML lazily — only when marker is clicked
function buildPopup(venue: NonNullable<Performance["venue"]>, performances: Performance[]): string {
  const showMap = new Map<string, { title: string; posterUrl: string | null; perfId: string; runId: string }>();
  for (const p of performances) {
    if (p.run?.show && !showMap.has(p.run.show.id)) {
      showMap.set(p.run.show.id, { title: p.run.show.title, posterUrl: p.run.show.posterUrl, perfId: p.id, runId: p.run.id });
    }
  }
  const shows = Array.from(showMap.values());

  if (shows.length === 1) {
    const perf = performances[0];
    const show = perf.run?.show;
    const company = perf.run?.productionCompany;
    const isSoldOut = perf.soldOut === true || perf.soldOut === "true";

    return `<a href="${perf.run?.id ? `/runs/${perf.run.id}` : `/showings/${perf.id}`}" style="font-family:sans-serif;max-width:260px;display:block;text-decoration:none;color:inherit;cursor:pointer;">
      <div style="display:flex;gap:10px;">
        ${show?.posterUrl ? `<img src="${show.posterUrl}" alt="" loading="lazy" style="width:50px;height:75px;object-fit:cover;border-radius:2px;flex-shrink:0;" />` : ""}
        <div style="flex:1;min-width:0;">
          <div style="font-weight:700;font-size:13px;line-height:1.2;margin-bottom:3px;color:#f3ebd5;">${esc(show?.title || "Untitled")}</div>
          ${company ? `<div style="font-size:11px;color:#8b8679;">${esc(company.name)}</div>` : ""}
          <div style="font-size:10px;color:#8b8679;margin-top:4px;">${performances.length} showing${performances.length !== 1 ? "s" : ""}</div>
        </div>
      </div>
      <div style="display:flex;gap:6px;margin-top:8px;">
        <span onclick="event.preventDefault();event.stopPropagation();window.location.href='/log?run=${perf.run?.id}'" style="flex:1;height:28px;display:flex;align-items:center;justify-content:center;background:#f84331;color:#111;border-radius:2px;cursor:pointer;font-size:11px;font-weight:600;">Log</span>
        ${!isSoldOut && perf.ticketUrl ? `<a href="${perf.ticketUrl}" target="_blank" rel="noopener" onclick="event.stopPropagation();" style="flex:1;height:28px;display:flex;align-items:center;justify-content:center;border:1px solid rgba(248,67,49,0.3);color:#f84331;border-radius:2px;font-size:11px;text-decoration:none;">Tickets</a>` : ""}
      </div>
    </a>`;
  }

  // Multi-show venue popup
  const posters = shows.slice(0, 6).map(s =>
    `<a href="${s.runId ? `/runs/${s.runId}` : `/showings/${s.perfId}`}" style="flex-shrink:0;width:48px;display:block;text-decoration:none;">
      <div style="width:48px;height:72px;background:#1a1a1a;border-radius:2px;overflow:hidden;border:1px solid #393E41;">
        ${s.posterUrl
          ? `<img src="${s.posterUrl}" alt="" loading="lazy" style="width:100%;height:100%;object-fit:cover;" />`
          : `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-size:8px;color:#8b8679;text-align:center;padding:4px;">${esc(s.title)}</div>`}
      </div>
    </a>`
  ).join("");

  return `<div style="font-family:sans-serif;max-width:280px;">
    <div style="font-weight:700;font-size:13px;margin-bottom:2px;">${esc(venue.name)}</div>
    <div style="font-size:11px;color:#8b8679;margin-bottom:8px;">${shows.length} show${shows.length !== 1 ? "s" : ""} · ${performances.length} showing${performances.length !== 1 ? "s" : ""}</div>
    <div style="display:flex;gap:4px;overflow-x:auto;padding-bottom:4px;">
      ${posters}
    </div>
    <a href="/venues/${venue.slug}" style="display:block;margin-top:8px;font-size:11px;color:#f84331;text-decoration:none;">View venue →</a>
  </div>`;
}

function reportBounds(map: L.Map, onBoundsChange: ((b: MapBounds) => void) | undefined) {
  if (!onBoundsChange) return;
  const b = map.getBounds();
  const sw = b.getSouthWest();
  const ne = b.getNorthEast();
  // Expand by 50% in each direction so small pans don't trigger a refetch
  const latPad = (ne.lat - sw.lat) * 0.5;
  const lngPad = (ne.lng - sw.lng) * 0.5;
  onBoundsChange({
    swLat: sw.lat - latPad, swLng: sw.lng - lngPad,
    neLat: ne.lat + latPad, neLng: ne.lng + lngPad,
  });
}

export function PerformanceMap({ performances, className = "", onBoundsChange }: PerformanceMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const clusterRef = useRef<L.MarkerClusterGroup | null>(null);
  const onBoundsChangeRef = useRef(onBoundsChange);
  onBoundsChangeRef.current = onBoundsChange;

  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;
    const map = L.map(mapRef.current, { zoomControl: false }).setView([40.7580, -73.9855], 13);
    if (window.matchMedia("(min-width: 768px)").matches) {
      L.control.zoom({ position: "bottomright" }).addTo(map);
    }
    L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/">CARTO</a>',
      maxZoom: 19,
    }).addTo(map);
    mapInstanceRef.current = map;

    // Report bounds immediately and on every pan/zoom settle
    reportBounds(map, onBoundsChangeRef.current);
    map.on('moveend', () => reportBounds(map, onBoundsChangeRef.current));

    return () => { map.remove(); mapInstanceRef.current = null; };
  }, []);

  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    // Remove old cluster layer
    if (clusterRef.current) {
      map.removeLayer(clusterRef.current);
    }

    const cluster = L.markerClusterGroup({
      maxClusterRadius: 40,
      spiderfyOnMaxZoom: true,
      showCoverageOnHover: false,
      iconCreateFunction: (c) => {
        const count = c.getChildCount();
        return L.divIcon({
          html: `<div style="width:32px;height:32px;background:#f84331;border:2px solid #111;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;color:#111;box-shadow:0 0 8px rgba(248,67,49,0.4);">${count}</div>`,
          className: "curtn-cluster",
          iconSize: [32, 32],
          iconAnchor: [16, 16],
        });
      },
    });

    const groups = groupByVenue(performances);
    const icon = L.divIcon({
      className: "curtn-marker",
      html: '<div style="width:12px;height:12px;background:#f84331;border:2px solid #111;border-radius:50%;box-shadow:0 0 6px rgba(248,67,49,0.5);"></div>',
      iconSize: [12, 12],
      iconAnchor: [6, 6],
    });

    for (const { venue, performances: venuePerfs } of groups) {
      if (!venue?.coordinates) continue;
      const { lat, lng } = venue.coordinates;

      // Lazy popup: build HTML only when marker is clicked
      const marker = L.marker([lat, lng], { icon });
      marker.on("click", () => {
        if (!marker.getPopup()) {
          marker.bindPopup(buildPopup(venue, venuePerfs), {
            className: "curtn-popup",
            closeButton: false,
            maxWidth: 300,
          });
        }
        marker.openPopup();
      });
      cluster.addLayer(marker);
    }

    map.addLayer(cluster);
    clusterRef.current = cluster;

  }, [performances]);

  return <div ref={mapRef} className={`w-full h-full ${className}`} />;
}
