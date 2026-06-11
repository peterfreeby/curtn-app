import { geocodeViaCensus } from './census'
import { geocodeViaNominatim } from './nominatim'

export interface ResolvedGeocode {
  lat: number
  lng: number
  matchedAddress?: string
  provider: 'census' | 'nominatim'
}

// Geocode a US address through the provider chain:
//   1. US Census  — free, unlimited, storable, authoritative for US street
//      addresses. Try first.
//   2. Nominatim  — fuzzier (catches odd formats / venue-ish strings Census
//      rejects), but rate-limited to ~1 req/sec. Only hit when Census misses.
//
// `onNominatimFallback` lets the caller throttle ONLY when we actually reach
// Nominatim (the queue worker needs the 1 req/sec pause; the interactive
// endpoint doesn't need to wait at all).
export async function geocodeAddress(
  query: string,
  opts: { onNominatimFallback?: () => Promise<void> } = {}
): Promise<ResolvedGeocode | null> {
  if (!query.trim()) return null

  const census = await geocodeViaCensus(query)
  if (census) {
    return {
      lat: census.lat,
      lng: census.lng,
      matchedAddress: census.matchedAddress,
      provider: 'census'
    }
  }

  if (opts.onNominatimFallback) await opts.onNominatimFallback()

  const osm = await geocodeViaNominatim(query)
  if (osm) {
    return { lat: osm.lat, lng: osm.lng, provider: 'nominatim' }
  }

  return null
}
