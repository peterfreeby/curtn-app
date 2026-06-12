"use client";

import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

interface AddressPreviewMapProps {
  lat: number;
  lng: number;
  className?: string;
}

// Leaflet's default marker icon references bundled PNG paths that 404 under
// Next/webpack. Use an image-free divIcon (a coral pin dot) instead — also
// keeps the print-glass palette.
const pinIcon = L.divIcon({
  className: "",
  html:
    '<div style="width:14px;height:14px;border-radius:9999px;' +
    "background:oklch(0.65 0.22 30);border:2px solid #111;" +
    'box-shadow:0 0 0 1px oklch(0.65 0.22 30);"></div>',
  iconSize: [14, 14],
  iconAnchor: [7, 7],
});

// Small single-pin preview map for verified venue addresses. Loaded via
// next/dynamic with ssr:false (leaflet touches window at import time).
export function AddressPreviewMap({ lat, lng, className = "" }: AddressPreviewMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);

  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;
    const map = L.map(mapRef.current, {
      zoomControl: false,
      attributionControl: false,
      dragging: false,
      scrollWheelZoom: false,
      doubleClickZoom: false,
    }).setView([lat, lng], 15);
    L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
      maxZoom: 19,
    }).addTo(map);
    markerRef.current = L.marker([lat, lng], { icon: pinIcon }).addTo(map);
    mapInstanceRef.current = map;

    // The container is revealed only after verification, so it may have had
    // zero size at init — Leaflet then renders blank tiles. Recompute once the
    // layout settles.
    requestAnimationFrame(() => map.invalidateSize());

    return () => {
      map.remove();
      mapInstanceRef.current = null;
      markerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Recenter/move the pin when a new verification comes back.
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;
    map.setView([lat, lng], 15);
    if (markerRef.current) markerRef.current.setLatLng([lat, lng]);
  }, [lat, lng]);

  return <div ref={mapRef} className={className} />;
}
