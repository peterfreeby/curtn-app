import L from "leaflet";

// Ask for the user's location and recenter the map on it. Falls back silently
// to whatever view the map already has (NYC default) if geolocation is
// unavailable or denied. `shouldSkip` lets callers bail if the user has already
// started interacting with the map before the (async) position resolves — we
// don't want to yank the viewport out from under them.
export function centerOnUserLocation(
  map: L.Map,
  shouldSkip: () => boolean,
  zoom = 13
) {
  if (typeof navigator === "undefined" || !navigator.geolocation) return;
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      if (shouldSkip()) return;
      map.setView([pos.coords.latitude, pos.coords.longitude], zoom);
    },
    () => {
      // Denied or errored — keep the default view. Nothing to do.
    },
    { enableHighAccuracy: false, timeout: 8000, maximumAge: 300000 }
  );
}
