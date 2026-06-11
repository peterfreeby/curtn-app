import axios from 'axios'
import { GeocodeResult } from './nominatim'

// US Census Bureau geocoder. Free, no API key, no meaningful rate limit, and
// results are storable. US-only and expects a parseable street address
// (number + street); it will not resolve a bare venue name or a city alone.
// For anything outside that envelope we fall back to Nominatim.
const CENSUS_ENDPOINT =
  'https://geocoding.geo.census.gov/geocoder/locations/onelineaddress'
const BENCHMARK = 'Public_AR_Current'
const REQUEST_TIMEOUT_MS = 15000

export interface CensusGeocodeResult extends GeocodeResult {
  matchedAddress: string
}

interface CensusMatch {
  matchedAddress?: string
  coordinates?: { x?: number; y?: number } // x = longitude, y = latitude
}

interface CensusResponse {
  result?: { addressMatches?: CensusMatch[] }
}

export async function geocodeViaCensus(
  query: string
): Promise<CensusGeocodeResult | null> {
  if (!query.trim()) return null

  try {
    const response = await axios.get<CensusResponse>(CENSUS_ENDPOINT, {
      params: {
        address: query,
        benchmark: BENCHMARK,
        format: 'json'
      },
      timeout: REQUEST_TIMEOUT_MS
    })

    const match = response.data?.result?.addressMatches?.[0]
    const lng = match?.coordinates?.x
    const lat = match?.coordinates?.y
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null

    return {
      lat: lat as number,
      lng: lng as number,
      matchedAddress: match?.matchedAddress ?? query
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.warn(`[geocoding] Census request failed for "${query}": ${message}`)
    return null
  }
}
