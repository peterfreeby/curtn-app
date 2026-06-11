"use client";

import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

interface AddressPreviewMapProps {
  lat: number;
  lng: number;
  className?: string;
}

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
    markerRef.current = L.marker([lat, lng]).addTo(map);
    mapInstanceRef.current = map;

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
