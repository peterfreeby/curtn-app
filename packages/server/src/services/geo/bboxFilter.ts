// Build the MongoDB `location` filter for a viewport bounding box.
//
// Returns a `$geoWithin` GeoJSON polygon clamped to valid lng/lat ranges, OR
// null when the box is effectively global (zoomed far out) or wrapped across
// the antimeridian. Null tells the caller to skip geo filtering and return
// everything (capped) — at world zoom you want all pins to cluster, not an
// empty map.
//
// The previous code fed raw, 50%-padded bounds straight into `$geometry`:
//   - coordinates beyond ±180 / ±90 made MongoDB throw → caught → empty result
//     → blank map (the reported bug);
//   - polygons larger than a hemisphere had their winding inverted by the
//     spherical engine → also empty.
// Clamping fixes the first; the world-skip fixes the second.
export function buildBboxLocationFilter(
  swLat: number,
  swLng: number,
  neLat: number,
  neLng: number
): Record<string, any> | null {
  const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))
  let s = clamp(swLat, -90, 90)
  let n = clamp(neLat, -90, 90)
  const w = clamp(swLng, -180, 180)
  const e = clamp(neLng, -180, 180)
  if (s > n) [s, n] = [n, s]

  // Antimeridian wrap (w >= e after clamping) or a near-hemispheric extent:
  // the polygon stops being meaningful / safe, so skip it and show all.
  const lngSpan = e - w
  const latSpan = n - s
  if (w >= e || lngSpan >= 180 || latSpan >= 90) return null

  return {
    $geoWithin: {
      $geometry: {
        type: 'Polygon',
        coordinates: [[[w, s], [e, s], [e, n], [w, n], [w, s]]]
      }
    }
  }
}
