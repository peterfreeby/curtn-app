import { useEffect, useState } from "react";

// Curtn's supported metros. They sit in distinct states, so snapping the user's
// GPS to the nearest metro is equivalent to picking a state code — which is what
// we filter venues by (venue.state is a reliable 2-letter code; city strings vary).
const METROS: Array<{ state: string; lat: number; lng: number }> = [
  { state: "NY", lat: 40.7128, lng: -74.006 },   // New York City
  { state: "MN", lat: 44.9778, lng: -93.265 },   // Minneapolis
  { state: "CA", lat: 34.0522, lng: -118.2437 }, // Los Angeles
];

// Rough great-circle distance (miles). Precision doesn't matter — we only compare.
function distanceMiles(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 3958.8;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLng = ((bLng - aLng) * Math.PI) / 180;
  const lat1 = (aLat * Math.PI) / 180;
  const lat2 = (bLat * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/**
 * Prompts for location once on mount and resolves to the state code of the
 * user's nearest supported metro (e.g. "NY"). Returns null while pending, or if
 * the user denies / geolocation is unavailable — callers should treat null as
 * "no filter, show everything".
 */
export function useNearbyMetroState(): string | null {
  const [metroState, setMetroState] = useState<string | null>(null);

  useEffect(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        let best: string | null = null;
        let bestDist = Infinity;
        for (const m of METROS) {
          const d = distanceMiles(latitude, longitude, m.lat, m.lng);
          if (d < bestDist) {
            bestDist = d;
            best = m.state;
          }
        }
        setMetroState(best);
      },
      () => {
        // Denied or errored — leave null so callers show everything.
      },
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 300000 }
    );
  }, []);

  return metroState;
}
