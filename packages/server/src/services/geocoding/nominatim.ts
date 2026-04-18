import axios from 'axios'

const NOMINATIM_ENDPOINT = 'https://nominatim.openstreetmap.org/search'
const USER_AGENT = 'CurtnBot/1.0 (https://curtn.com; hello@curtn.com)'
const REQUEST_TIMEOUT_MS = 15000

export interface GeocodeResult {
  lat: number
  lng: number
}

interface NominatimHit {
  lat: string
  lon: string
}

export async function geocodeViaNominatim(query: string): Promise<GeocodeResult | null> {
  if (!query.trim()) return null

  try {
    const response = await axios.get<NominatimHit[]>(NOMINATIM_ENDPOINT, {
      params: {
        q: query,
        format: 'json',
        limit: 1
      },
      headers: {
        'User-Agent': USER_AGENT,
        'Accept-Language': 'en'
      },
      timeout: REQUEST_TIMEOUT_MS
    })

    const hit = response.data?.[0]
    if (!hit) return null

    const lat = parseFloat(hit.lat)
    const lng = parseFloat(hit.lon)
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null

    return { lat, lng }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.warn(`[geocoding] Nominatim request failed for "${query}": ${message}`)
    return null
  }
}
