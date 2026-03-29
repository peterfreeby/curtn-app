"use client";

import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

interface CastMember {
  id: string;
  person: { id: string; name: string; headshotUrl: string | null };
  role: string;
}

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
  effectiveDescription?: string | null;
  run: {
    id: string;
    show: {
      id: string;
      title: string;
      description?: string | null;
      posterUrl: string | null;
      performanceTypes: string[];
      averageRating?: number | null;
      reviewCount?: number;
    };
    productionCompany: { name: string } | null;
    averageRating?: number | null;
    reviewCount?: number;
    cast?: CastMember[];
  } | null;
}

interface PerformanceMapProps {
  performances: Performance[];
  className?: string;
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

function stars(rating: number, count: number): string {
  return `<span style="color:#f84331;font-size:12px;">${"★".repeat(Math.floor(rating))}${rating % 1 >= 0.25 ? "½" : ""}</span> <span style="color:#8b8679;font-size:10px;">(${count})</span>`;
}

function buildSinglePopup(perf: Performance): string {
  const show = perf.run?.show;
  const company = perf.run?.productionCompany;
  const rating = perf.run?.averageRating ?? show?.averageRating;
  const reviewCount = perf.run?.reviewCount ?? show?.reviewCount ?? 0;
  const desc = (perf.effectiveDescription || show?.description || "").slice(0, 120);
  const cast = perf.run?.cast ?? [];
  const isSoldOut = perf.soldOut === true || perf.soldOut === "true";

  const facepile = cast.length > 0
    ? `<div style="display:flex;margin:8px 0 4px;">
        ${cast.slice(0, 5).map(c =>
          c.person.headshotUrl
            ? `<img src="${c.person.headshotUrl}" title="${esc(c.person.name)}" style="width:24px;height:24px;border-radius:50%;border:2px solid #111;margin-left:-4px;object-fit:cover;" />`
            : `<div title="${esc(c.person.name)}" style="width:24px;height:24px;border-radius:50%;border:2px solid #111;margin-left:-4px;background:#393E41;display:flex;align-items:center;justify-content:center;font-size:9px;font-weight:700;color:#B5BBBF;">${c.person.name.charAt(0)}</div>`
        ).join("")}
        ${cast.length > 5 ? `<div style="width:24px;height:24px;border-radius:50%;border:2px solid #111;margin-left:-4px;background:#f84331;display:flex;align-items:center;justify-content:center;font-size:9px;font-weight:700;color:#111;">+${cast.length - 5}</div>` : ""}
      </div>`
    : "";

  // Phosphor icon unicodes
  const iconPlus = "\uE3D4";
  const iconEye = "\uE220";
  const iconTicket = "\uE490";
  // Nested rounded corners: popup border-radius is 4px, padding ~10px → inner radius ~0 but we use 2px for feel
  const innerRadius = "2px";

  return `<a href="/showings/${perf.id}" style="font-family:sans-serif;max-width:280px;display:block;text-decoration:none;color:inherit;cursor:pointer;">
    <div style="display:flex;gap:10px;">
      ${show?.posterUrl ? `<img src="${show.posterUrl}" alt="" style="width:60px;height:90px;object-fit:cover;border-radius:${innerRadius};flex-shrink:0;" />` : ""}
      <div style="flex:1;min-width:0;">
        <div style="font-weight:700;font-size:14px;line-height:1.2;margin-bottom:3px;color:#f3ebd5;">${esc(show?.title || "Untitled")}</div>
        ${company ? `<div style="font-size:11px;color:#8b8679;">${esc(company.name)}</div>` : ""}
        ${rating ? `<div style="margin-top:4px;">${stars(rating, reviewCount)}</div>` : ""}
      </div>
    </div>
    ${desc ? `<div style="font-size:11px;color:#B5BBBF;margin-top:8px;line-height:1.5;">${esc(desc)}${desc.length >= 120 ? "…" : ""}</div>` : ""}
    ${facepile}
    <div style="display:flex;gap:6px;margin-top:10px;align-items:center;">
      <span onclick="event.preventDefault();event.stopPropagation();window.location.href='/log?run=${perf.run?.id}'" style="width:28px;height:28px;display:flex;align-items:center;justify-content:center;background:#f84331;color:#111;border-radius:${innerRadius};cursor:pointer;font-family:'Phosphor';font-size:14px;" title="Log">${iconPlus}</span>
      <span onclick="event.preventDefault();event.stopPropagation();" style="width:28px;height:28px;display:flex;align-items:center;justify-content:center;border:1px solid #393E41;color:#8b8679;border-radius:${innerRadius};cursor:pointer;font-family:'Phosphor';font-size:14px;" title="Watchlist">${iconEye}</span>
      ${!isSoldOut && perf.ticketUrl ? `<a href="${perf.ticketUrl}" target="_blank" rel="noopener" onclick="event.stopPropagation();" style="width:28px;height:28px;display:flex;align-items:center;justify-content:center;border:1px solid rgba(248,67,49,0.3);color:#f84331;border-radius:${innerRadius};cursor:pointer;font-family:'Phosphor';font-size:14px;text-decoration:none;" title="Tickets">${iconTicket}</a>` : ""}
    </div>
  </a>`;
}

function buildMultiPopup(venue: NonNullable<Performance["venue"]>, performances: Performance[]): string {
  const showMap = new Map<string, { title: string; posterUrl: string | null; perfId: string }>();
  for (const p of performances) {
    if (p.run?.show && !showMap.has(p.run.show.id)) {
      showMap.set(p.run.show.id, { title: p.run.show.title, posterUrl: p.run.show.posterUrl, perfId: p.id });
    }
  }
  const shows = Array.from(showMap.values());

  const posters = shows.slice(0, 8).map(s =>
    `<a href="/showings/${s.perfId}" style="flex-shrink:0;width:55px;display:block;text-decoration:none;transition:transform 0.15s;" onmouseover="this.style.transform='translateY(-4px)'" onmouseout="this.style.transform=''">
      <div style="width:55px;height:82px;background:#1a1a1a;border-radius:2px;overflow:hidden;border:1px solid #393E41;">
        ${s.posterUrl
          ? `<img src="${s.posterUrl}" alt="" style="width:100%;height:100%;object-fit:cover;" />`
          : `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-size:8px;color:#8b8679;text-align:center;padding:4px;">${esc(s.title)}</div>`}
      </div>
    </a>`
  ).join("");

  return `<div style="font-family:sans-serif;max-width:320px;">
    <div style="font-weight:700;font-size:13px;margin-bottom:2px;">${esc(venue.name)}</div>
    <div style="font-size:11px;color:#8b8679;margin-bottom:8px;">${shows.length} show${shows.length !== 1 ? "s" : ""} · ${performances.length} performance${performances.length !== 1 ? "s" : ""}</div>
    <div style="display:flex;gap:4px;overflow-x:auto;padding-bottom:4px;">
      ${posters}
    </div>
    <a href="/venues/${venue.slug}" style="display:block;margin-top:8px;font-size:11px;color:#f84331;text-decoration:none;">View venue →</a>
  </div>`;
}

export function PerformanceMap({ performances, className = "" }: PerformanceMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);

  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;
    const map = L.map(mapRef.current, { zoomControl: false }).setView([40.7580, -73.9855], 13);
    L.control.zoom({ position: "bottomright" }).addTo(map);
    L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/">CARTO</a>',
      maxZoom: 19,
    }).addTo(map);
    mapInstanceRef.current = map;
    return () => { map.remove(); mapInstanceRef.current = null; };
  }, []);

  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;
    map.eachLayer(layer => { if (layer instanceof L.Marker) map.removeLayer(layer); });

    const groups = groupByVenue(performances);
    const bounds: L.LatLngExpression[] = [];
    const icon = L.divIcon({
      className: "curtn-marker",
      html: '<div style="width:12px;height:12px;background:#f84331;border:2px solid #111;border-radius:50%;box-shadow:0 0 6px rgba(248,67,49,0.5);"></div>',
      iconSize: [12, 12],
      iconAnchor: [6, 6],
    });

    for (const { venue, performances: venuePerfs } of groups) {
      if (!venue?.coordinates) continue;
      const { lat, lng } = venue.coordinates;
      bounds.push([lat, lng]);

      const uniqueShows = new Set(venuePerfs.map(p => p.run?.show?.id).filter(Boolean));
      const popup = uniqueShows.size === 1
        ? buildSinglePopup(venuePerfs[0])
        : buildMultiPopup(venue, venuePerfs);

      L.marker([lat, lng], { icon }).addTo(map).bindPopup(popup, {
        className: "curtn-popup",
        closeButton: false,
        maxWidth: 320,
      });
    }

    if (bounds.length > 1) map.fitBounds(bounds as L.LatLngBoundsExpression, { padding: [40, 40] });
    else if (bounds.length === 1) map.setView(bounds[0] as L.LatLngExpression, 15);
  }, [performances]);

  return <div ref={mapRef} className={`w-full h-full ${className}`} />;
}
