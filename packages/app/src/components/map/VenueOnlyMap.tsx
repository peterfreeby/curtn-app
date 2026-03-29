"use client";

import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

interface Venue {
  id: string;
  name: string;
  slug: string;
  city: string;
  coordinates: { lat: number; lng: number };
}

interface VenueOnlyMapProps {
  venues: Venue[];
  className?: string;
}

export function VenueOnlyMap({ venues, className = "" }: VenueOnlyMapProps) {
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

    const bounds: L.LatLngExpression[] = [];
    const icon = L.divIcon({
      className: "curtn-marker",
      html: '<div style="width:10px;height:10px;background:#f84331;border:2px solid #111;border-radius:50%;opacity:0.6;"></div>',
      iconSize: [10, 10],
      iconAnchor: [5, 5],
    });

    for (const venue of venues) {
      if (!venue.coordinates?.lat) continue;
      const { lat, lng } = venue.coordinates;
      bounds.push([lat, lng]);

      L.marker([lat, lng], { icon }).addTo(map).bindPopup(
        `<div style="font-family:sans-serif;">
          <div style="font-weight:600;font-size:12px;">${venue.name}</div>
          <div style="font-size:10px;color:#8b8679;margin-top:2px;">Loading shows...</div>
        </div>`,
        { className: "curtn-popup", closeButton: false }
      );
    }

    if (bounds.length > 1) map.fitBounds(bounds as L.LatLngBoundsExpression, { padding: [40, 40] });
    else if (bounds.length === 1) map.setView(bounds[0] as L.LatLngExpression, 15);
  }, [venues]);

  return <div ref={mapRef} className={`w-full h-full ${className}`} />;
}
