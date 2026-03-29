"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

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

interface PerformanceMapProps {
  performances: Performance[];
  className?: string;
}

// Group performances by venue for clustering
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

export function PerformanceMap({ performances, className = "" }: PerformanceMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);

  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    // Dark tile layer
    const map = L.map(mapRef.current, {
      zoomControl: false,
    }).setView([40.7580, -73.9855], 13); // NYC default

    L.control.zoom({ position: "bottomright" }).addTo(map);

    L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/">CARTO</a>',
      maxZoom: 19,
    }).addTo(map);

    mapInstanceRef.current = map;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // Update markers when performances change
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    // Clear existing markers
    map.eachLayer((layer) => {
      if (layer instanceof L.Marker) map.removeLayer(layer);
    });

    const groups = groupByVenue(performances);
    const bounds: L.LatLngExpression[] = [];

    // Custom coral marker icon
    const markerIcon = L.divIcon({
      className: "curtn-marker",
      html: `<div style="width:12px;height:12px;background:#FE5F55;border:2px solid #161316;border-radius:50%;box-shadow:0 0 6px rgba(254,95,85,0.5);"></div>`,
      iconSize: [12, 12],
      iconAnchor: [6, 6],
    });

    for (const group of groups) {
      const { venue, performances: venuePerfs } = group;
      if (!venue?.coordinates) continue;

      const { lat, lng } = venue.coordinates;
      bounds.push([lat, lng]);

      const showNames = [...new Set(venuePerfs.map((p) => p.run?.show?.title).filter(Boolean))];
      const count = venuePerfs.length;

      const popupContent = `
        <div style="font-family:sans-serif;max-width:220px;">
          <div style="font-weight:600;font-size:13px;margin-bottom:4px;">${venue.name}</div>
          <div style="font-size:11px;color:#B5BBBF;margin-bottom:6px;">${count} performance${count !== 1 ? "s" : ""}</div>
          ${showNames
            .slice(0, 5)
            .map((name) => `<div style="font-size:12px;margin-bottom:2px;">${name}</div>`)
            .join("")}
          ${showNames.length > 5 ? `<div style="font-size:11px;color:#B5BBBF;">+${showNames.length - 5} more</div>` : ""}
          <a href="/venues/${venue.slug}" style="display:block;margin-top:8px;font-size:11px;color:#FE5F55;text-decoration:none;">View venue &rarr;</a>
        </div>
      `;

      L.marker([lat, lng], { icon: markerIcon })
        .addTo(map)
        .bindPopup(popupContent, {
          className: "curtn-popup",
          closeButton: false,
        });
    }

    // Fit bounds if we have markers
    if (bounds.length > 1) {
      map.fitBounds(bounds as L.LatLngBoundsExpression, { padding: [40, 40] });
    } else if (bounds.length === 1) {
      map.setView(bounds[0] as L.LatLngExpression, 15);
    }
  }, [performances]);

  return (
    <div
      ref={mapRef}
      className={`w-full rounded-sm border border-curtn-dark/50 ${className}`}
      style={{ height: "400px" }}
    />
  );
}
