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

interface VenueOnlyMapProps {
  venues: Venue[];
  className?: string;
}

export function VenueOnlyMap({ venues, className = "" }: VenueOnlyMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const clusterRef = useRef<L.MarkerClusterGroup | null>(null);

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

    if (clusterRef.current) {
      map.removeLayer(clusterRef.current);
    }

    const cluster = L.markerClusterGroup({
      maxClusterRadius: 40,
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

    if (bounds.length > 1) map.fitBounds(bounds as L.LatLngBoundsExpression, { padding: [40, 40] });
    else if (bounds.length === 1) map.setView(bounds[0] as L.LatLngExpression, 15);
  }, [venues]);

  return <div ref={mapRef} className={`w-full h-full ${className}`} />;
}
