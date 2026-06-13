import { useEffect, useState } from "react";
import L from "leaflet";

// NYC (Times Square) — the default view when geolocation is unavailable/denied.
export const NYC_CENTER: [number, number] = [40.7580, -73.9855];
export const DEFAULT_ZOOM = 13;

// Resolve the user's location ONCE per page mount. Returns null until/unless a
// position is granted. Lives at the page level so the map can swap components
// (VenueOnlyMap → PerformanceMap) without re-prompting or re-centering.
export function useUserLocation(): [number, number] | null {
  const [coords, setCoords] = useState<[number, number] | null>(null);

  useEffect(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => setCoords([pos.coords.latitude, pos.coords.longitude]),
      () => {
        // Denied or errored — keep the NYC default. Nothing to do.
      },
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 300000 }
    );
  }, []);

  return coords;
}

// One-time auto-center for a Leaflet map. Centers on `center` as soon as it's
// known, but never after the user has started interacting (drag OR zoom) and
// never more than once. `interactedRef`/`appliedRef` are caller-owned refs so
// the guard survives re-renders. Returns a cleanup-free no-op; call it from the
// effect that watches `center`.
export function autoCenterOnce(
  map: L.Map,
  center: [number, number] | null,
  interactedRef: { current: boolean },
  appliedRef: { current: boolean }
) {
  if (!center || appliedRef.current || interactedRef.current) return;
  appliedRef.current = true;
  map.setView(center, DEFAULT_ZOOM);
}
