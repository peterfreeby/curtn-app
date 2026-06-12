"use client";

import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet.markercluster";
import "leaflet.markercluster/dist/MarkerCluster.css";

interface Venue {
  id: string;
  name: string;
  slug: string;
  city: string;
  coordinates: { lat: number; lng: number };
}

interface MapBounds {
  swLat: number; swLng: number; neLat: number; neLng: number;
}

interface VenueOnlyMapProps {
  venues: Venue[];
  className?: string;
  onBoundsChange?: (bounds: MapBounds) => void;
}

function reportBounds(map: L.Map, onBoundsChange: ((b: MapBounds) => void) | undefined) {
  if (!onBoundsChange) return;
  const b = map.getBounds();
  const sw = b.getSouthWest();
  const ne = b.getNorthEast();
  const latPad = (ne.lat - sw.lat) * 0.5;
  const lngPad = (ne.lng - sw.lng) * 0.5;
  onBoundsChange({
    swLat: sw.lat - latPad, swLng: sw.lng - lngPad,
    neLat: ne.lat + latPad, neLng: ne.lng + lngPad,
  });
}

export function VenueOnlyMap({ venues, className = "", onBoundsChange }: VenueOnlyMapProps) {
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

    reportBounds(map, onBoundsChangeRef.current);
    map.on('moveend', () => reportBounds(map, onBoundsChangeRef.current));

    return () => { map.remove(); mapInstanceRef.current = null; };
  }, []);

  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (clusterRef.current) {
      map.removeLayer(clusterRef.current);
    }

    const cluster = L.markerClusterGroup({
      // 80px default — see PerformanceMap; 40 left close venues unclustered.
      maxClusterRadius: 80,
      showCoverageOnHover: false,
      iconCreateFunction: (c) => {
        const count = c.getChildCount();
        return L.divIcon({
          html: `<div style="width:28px;height:28px;background:#f84331;border:2px solid #111;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;color:#111;opacity:0.7;">${count}</div>`,
          className: "curtn-cluster",
          iconSize: [28, 28],
          iconAnchor: [14, 14],
        });
      },
    });

    const icon = L.divIcon({
      className: "curtn-marker",
      html: '<div style="width:10px;height:10px;background:#f84331;border:2px solid #111;border-radius:50%;opacity:0.6;"></div>',
      iconSize: [10, 10],
      iconAnchor: [5, 5],
    });

    for (const venue of venues) {
      if (!venue.coordinates?.lat) continue;
      const { lat, lng } = venue.coordinates;

      const marker = L.marker([lat, lng], { icon });
      marker.on("click", () => {
        if (!marker.getPopup()) {
          marker.bindPopup(
            `<div style="font-family:sans-serif;">
              <div style="font-weight:600;font-size:12px;">${venue.name}</div>
              <div style="font-size:10px;color:#8b8679;margin-top:2px;">Loading shows...</div>
            </div>`,
            { className: "curtn-popup", closeButton: false }
          );
        }
        marker.openPopup();
      });
      cluster.addLayer(marker);
    }

    map.addLayer(cluster);
    clusterRef.current = cluster;

  }, [venues]);

  return <div ref={mapRef} className={`w-full h-full ${className}`} />;
}
