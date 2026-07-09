import '../config/env'
import mongoose from 'mongoose'
import axios from 'axios'
import { VenueModel } from '../entities/venue/venueModel'
import { mergeVenueCore } from '../entities/venue/mutations/mergeVenueCore'
import { geocodeAddress } from '../services/geocoding/geocodeAddress'

// ---------------------------------------------------------------------------
// Bulk venue address cleanup.
//
// Context: 118 of 316 venues had no address. Most are NOT missing data — they
// are duplicates or old/short names of venues that already exist (often with a
// correct address). This script:
//   1. Merges duplicates/old-names into their canonical record.
//   2. For survivors that still lack an address, resolves one. Where the street
//      address is known it is verified through the production geocoder
//      (US Census -> OSM Nominatim); where only a name is known it is resolved
//      by free-text Nominatim. Either way the result is validated against an
//      expected metro bounding box, so a bad match is flagged, not written.
//   3. Backfills coordinates for merge targets that already have an address but
//      no map pin, geocoding their OWN stored address (never their name).
//
// "Verified" = the address geocodes cleanly through the existing pipeline and
// lands the pin in the right metro. Anything that can't be resolved confidently
// is routed to REVIEW rather than getting a plausible-but-wrong address.
//
// Default is DRY RUN. Pass --commit to write.
//   npx tsnd --transpile-only src/scripts/bulkVenueAddresses.ts            # dry run
//   npx tsnd --transpile-only src/scripts/bulkVenueAddresses.ts --commit   # write
// ---------------------------------------------------------------------------

const COMMIT = process.argv.includes('--commit')
const NOMINATIM_ENDPOINT = 'https://nominatim.openstreetmap.org/search'
const USER_AGENT = 'CurtnBot/1.0 (https://curtn.com; hello@curtn.com)'
const THROTTLE_MS = 1100 // Nominatim: max 1 req/sec

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

// Metro bounding boxes: [minLat, maxLat, minLng, maxLng]. A geocode result
// outside its expected box is treated as a wrong match and sent to review.
const METROS: Record<string, [number, number, number, number]> = {
  NYC: [40.40, 41.05, -74.30, -73.60],
  LA: [33.30, 34.90, -119.40, -117.00] // greater LA incl. OC + Ventura
}

// --- Tier 1: merge a duplicate/old-name (source) INTO an existing canonical
// venue that already has an address. Source is deleted; its performances/runs
// move to the target. Keys/values are exact venue `name` values. ---
const MERGE_INTO_EXISTING: Record<string, string> = {
  'Ethel Barrymore': 'Barrymore Theatre',
  'Gershwin': 'Gershwin Theatre',
  'Gershwin Theater': 'Gershwin Theatre',
  'Golden': 'Golden Theatre',
  'Golden Theater': 'Golden Theatre',
  'Imperial': 'Imperial Theatre',
  'Longacre': 'Longacre Theatre',
  'Lunt-Fontanne': 'Lunt-Fontanne Theatre',
  'Minskoff': 'Minskoff Theatre',
  'Music Box': 'Music Box Theatre',
  'Nederlander': 'Nederlander Theatre',
  'Neil Simon': 'Neil Simon Theatre',
  'New Amsterdam': 'New Amsterdam Theatre',
  'Palace': 'Palace Theatre',
  'Richard Rodgers': 'Richard Rodgers Theatre',
  'Shubert': 'Shubert Theatre',
  'St. James': 'St. James Theatre',
  'Stephen Sondheim': 'Stephen Sondheim Theatre',
  // renamed Broadway houses -> current, addressed record
  'Martin Beck': 'Al Hirschfeld',
  'Royale': 'Bernard B. Jacobs Theatre',
  'Jacobs': 'Bernard B. Jacobs Theatre',
  'Plymouth': 'Gerald Schoenfeld Theatre',
  'Schoenfeld': 'Gerald Schoenfeld Theatre',
  'Virginia': 'August Wilson Theatre',
  'Friedman': 'Samuel J. Friedman Theatre',
  'Helen Hayes': 'Hayes Theater',
  'Henry Miller': 'Stephen Sondheim Theatre',
  'Henry Miller (Rndabt)': 'Stephen Sondheim Theatre',
  'James Earl Jones Theater': 'James Earl Jones Theatre',
  // non-Broadway duplicates of existing addressed records
  'Perelman Performing Arts Center': 'Perelman Performing Arts Center - PAC NYC',
  'The Judith O. Rubin Theater': 'Perelman Performing Arts Center - PAC NYC',
  'The Public': 'The Public Theater',
  'wild project': 'The Wild Project',
  'The Barrow Group': 'Barrow Group Theatre',
  'Vivian Beaumont': 'Vivian Beaumont Theater',
  'Irish Rep (W. Scott McLucas Studio)': 'Irish Repertory Theatre'
}

// --- Tier 2: groups of address-less records that are the SAME venue. Merge
// the rest into the survivor (first element), then geocode the survivor. ---
const MERGE_GROUPS_NEW: string[][] = [
  ["Eugene O'Neill Theatre", "Eugene O'Neill"],
  ['Marquis Theatre', 'Marquis'],
  ['Majestic Theatre', 'Majestic'],
  ['Walter Kerr Theatre', 'Walter Kerr'],
  ['Studio 54', "Studio 54 ('98)"],
  ['The Laurie Beechman Theatre', 'Laurie Beechman Theater'],
  ['Culture Lab LIC', 'Culture Lab LIC at The Plaxall Gallery'],
  // 42nd St house: built as Ford Center -> Hilton -> Foxwoods -> Lyric Theatre.
  // All one building at 213 W 42nd. RISKY (7 -> 1) — review the pin after.
  ['Lyric Theatre', 'Lyric', 'Ford Center', 'Ford Center (Livent)', 'Ford Center (Tcn)', 'Foxwoods', 'Hilton Theatre']
]

// --- Tier 3: venues to give an address. `address` = curated street (verified
// via Census); `nameQuery` = free-text fallback when no street is known. The
// stored `city` field is unreliable ("NYC/NY" on everything, including LA
// venues), so city/state come from curation or the geocode result. ---
interface GeoSpec { address?: string; city?: string; state?: string; nameQuery?: string; metro: keyof typeof METROS }
const GEOCODE_BY_NAME: Record<string, GeoSpec> = {
  // merge targets whose stored address was the placeholder "TBD" — give them
  // real, curated addresses (all well-known houses).
  'Gershwin Theatre': { address: '222 West 51st Street', city: 'New York', state: 'NY', metro: 'NYC' },
  'Golden Theatre': { address: '252 West 45th Street', city: 'New York', state: 'NY', metro: 'NYC' },
  'Imperial Theatre': { address: '249 West 45th Street', city: 'New York', state: 'NY', metro: 'NYC' },
  'Longacre Theatre': { address: '220 West 48th Street', city: 'New York', state: 'NY', metro: 'NYC' },
  'Lunt-Fontanne Theatre': { address: '205 West 46th Street', city: 'New York', state: 'NY', metro: 'NYC' },
  'Nederlander Theatre': { address: '208 West 41st Street', city: 'New York', state: 'NY', metro: 'NYC' },
  'Palace Theatre': { address: '1564 Broadway', city: 'New York', state: 'NY', metro: 'NYC' },
  'Richard Rodgers Theatre': { address: '226 West 46th Street', city: 'New York', state: 'NY', metro: 'NYC' },
  'Gerald Schoenfeld Theatre': { address: '236 West 45th Street', city: 'New York', state: 'NY', metro: 'NYC' },
  'Samuel J. Friedman Theatre': { address: '261 West 47th Street', city: 'New York', state: 'NY', metro: 'NYC' },
  'Hayes Theater': { address: '240 West 44th Street', city: 'New York', state: 'NY', metro: 'NYC' },
  'Perelman Performing Arts Center - PAC NYC': { address: '251 Fulton Street', city: 'New York', state: 'NY', metro: 'NYC' },
  'The Public Theater': { address: '425 Lafayette Street', city: 'New York', state: 'NY', metro: 'NYC' },
  'The Wild Project': { address: '195 East 3rd Street', city: 'New York', state: 'NY', metro: 'NYC' },
  'Vivian Beaumont Theater': { address: '150 West 65th Street', city: 'New York', state: 'NY', metro: 'NYC' },
  'Irish Repertory Theatre': { address: '132 West 22nd Street', city: 'New York', state: 'NY', metro: 'NYC' },
  // survivors of MERGE_GROUPS_NEW
  "Eugene O'Neill Theatre": { address: '230 West 49th Street', city: 'New York', state: 'NY', metro: 'NYC' },
  'Marquis Theatre': { address: '210 West 46th Street', city: 'New York', state: 'NY', metro: 'NYC' },
  'Majestic Theatre': { address: '245 West 44th Street', city: 'New York', state: 'NY', metro: 'NYC' },
  'Walter Kerr Theatre': { address: '219 West 48th Street', city: 'New York', state: 'NY', metro: 'NYC' },
  'Studio 54': { address: '254 West 54th Street', city: 'New York', state: 'NY', metro: 'NYC' },
  'The Laurie Beechman Theatre': { address: '407 West 42nd Street', city: 'New York', state: 'NY', metro: 'NYC' },
  'Culture Lab LIC': { address: '5-25 46th Avenue', city: 'Long Island City', state: 'NY', metro: 'NYC' },
  'Lyric Theatre': { address: '213 West 42nd Street', city: 'New York', state: 'NY', metro: 'NYC' },
  // NYC — known street addresses
  'Gallery Players': { address: '199 14th Street', city: 'Brooklyn', state: 'NY', metro: 'NYC' },
  'Here Arts Center': { address: '145 Avenue of the Americas', city: 'New York', state: 'NY', metro: 'NYC' },
  'House of the Redeemer': { address: '7 East 95th Street', city: 'New York', state: 'NY', metro: 'NYC' },
  'INTAR Theatre': { address: '500 West 52nd Street', city: 'New York', state: 'NY', metro: 'NYC' },
  'Lincoln Center Theater': { address: '150 West 65th Street', city: 'New York', state: 'NY', metro: 'NYC' },
  'Linda Gross Theater': { address: '336 West 20th Street', city: 'New York', state: 'NY', metro: 'NYC' },
  'Lucille Lortel Theatre': { address: '121 Christopher Street', city: 'New York', state: 'NY', metro: 'NYC' },
  'Manhattan School of Music': { address: '130 Claremont Avenue', city: 'New York', state: 'NY', metro: 'NYC' },
  'Manhattan Theatre Club': { address: '311 West 43rd Street', city: 'New York', state: 'NY', metro: 'NYC' },
  'Marjorie S. Deane Little Theater': { address: '5 West 63rd Street', city: 'New York', state: 'NY', metro: 'NYC' },
  'Minetta Lane Theatre': { address: '18 Minetta Lane', city: 'New York', state: 'NY', metro: 'NYC' },
  'New World Stages': { address: '340 West 50th Street', city: 'New York', state: 'NY', metro: 'NYC' },
  'New York City Center': { address: '131 West 55th Street', city: 'New York', state: 'NY', metro: 'NYC' },
  'New York Theatre Workshop': { address: '79 East 4th Street', city: 'New York', state: 'NY', metro: 'NYC' },
  'NYU Tisch Drama, Loewe Theater': { address: '721 Broadway', city: 'New York', state: 'NY', metro: 'NYC' },
  'NYU Tisch School of the Arts, Theater 104': { address: '721 Broadway', city: 'New York', state: 'NY', metro: 'NYC' },
  'Peter B. Lewis Theater': { address: '1071 Fifth Avenue', city: 'New York', state: 'NY', metro: 'NYC' },
  'Repertorio Español': { address: '138 East 27th Street', city: 'New York', state: 'NY', metro: 'NYC' },
  'Sheen Center Shiner Theatre': { address: '18 Bleecker Street', city: 'New York', state: 'NY', metro: 'NYC' },
  "St Luke's Theatre": { address: '308 West 46th Street', city: 'New York', state: 'NY', metro: 'NYC' },
  'The New School (Ernst C. Stiefel Hall)': { address: '66 West 12th Street', city: 'New York', state: 'NY', metro: 'NYC' },
  'The Pershing Square Signature Center': { address: '480 West 42nd Street', city: 'New York', state: 'NY', metro: 'NYC' },
  'The Producers Club': { address: '358 West 44th Street', city: 'New York', state: 'NY', metro: 'NYC' },
  'The Tank': { address: '312 West 36th Street', city: 'New York', state: 'NY', metro: 'NYC' },
  'Thalia Spanish Theatre': { address: '41-17 Greenpoint Avenue', city: 'Sunnyside', state: 'NY', metro: 'NYC' },
  'Theatre Row': { address: '410 West 42nd Street', city: 'New York', state: 'NY', metro: 'NYC' },
  'Urban Stages': { address: '259 West 30th Street', city: 'New York', state: 'NY', metro: 'NYC' },
  // LA / SoCal — known street addresses
  'Geffen Playhouse': { address: '10886 Le Conte Avenue', city: 'Los Angeles', state: 'CA', metro: 'LA' },
  'Glendale Centre Theatre': { address: '324 North Orange Street', city: 'Glendale', state: 'CA', metro: 'LA' },
  'La Mirada Theatre for the Performing Arts': { address: '14900 La Mirada Boulevard', city: 'La Mirada', state: 'CA', metro: 'LA' },
  'Laguna Playhouse': { address: '606 Laguna Canyon Road', city: 'Laguna Beach', state: 'CA', metro: 'LA' },
  'Odyssey Theatre Ensemble': { address: '2055 South Sepulveda Boulevard', city: 'Los Angeles', state: 'CA', metro: 'LA' },
  'Pacific Resident Theatre': { address: '703 Venice Boulevard', city: 'Venice', state: 'CA', metro: 'LA' },
  'Pantages Theatre': { address: '6233 Hollywood Boulevard', city: 'Los Angeles', state: 'CA', metro: 'LA' },
  'Rubicon Theatre': { address: '1006 East Main Street', city: 'Ventura', state: 'CA', metro: 'LA' },
  'Ruskin Group Theatre': { address: '3000 Airport Avenue', city: 'Santa Monica', state: 'CA', metro: 'LA' },
  'Santa Monica Playhouse': { address: '1211 4th Street', city: 'Santa Monica', state: 'CA', metro: 'LA' },
  'South Coast Repertory': { address: '655 Town Center Drive', city: 'Costa Mesa', state: 'CA', metro: 'LA' },
  'The Broadwater': { address: '6320 Santa Monica Boulevard', city: 'Los Angeles', state: 'CA', metro: 'LA' },
  'The Gem Theatre': { address: '12852 Main Street', city: 'Garden Grove', state: 'CA', metro: 'LA' },
  'The Group Rep Theatre': { address: '10900 Burbank Boulevard', city: 'North Hollywood', state: 'CA', metro: 'LA' },
  'The Ivy Substation': { address: '9070 Venice Boulevard', city: 'Culver City', state: 'CA', metro: 'LA' },
  'The Matrix': { address: '7657 Melrose Avenue', city: 'Los Angeles', state: 'CA', metro: 'LA' },
  'The Nocturne Theater': { address: '324 North Orange Street', city: 'Glendale', state: 'CA', metro: 'LA' },
  'Victory Theatre Center': { address: '3326 West Victory Boulevard', city: 'Burbank', state: 'CA', metro: 'LA' },
  'Wallis Annenberg Center for the Performing Arts': { address: '9390 Santa Monica Boulevard', city: 'Beverly Hills', state: 'CA', metro: 'LA' },
  'Whitefire Theatre': { address: '13500 Ventura Boulevard', city: 'Sherman Oaks', state: 'CA', metro: 'LA' },
  'Zephyr Theatre': { address: '7456 Melrose Avenue', city: 'Los Angeles', state: 'CA', metro: 'LA' }
}

// --- Tier 4: defunct / ambiguous / junk / can't-place. Never auto-written.
// Reported for a human decision. ---
const REVIEW: Record<string, string> = {
  'Criterion': 'Defunct (Criterion Center Stage Right, closed ~2000). Historical address only.',
  'Fillmore East': 'Defunct since 1971 (105 Second Ave). Historical.',
  "Niblo's Garden": 'Defunct 19th-century venue (closed 1895). Historical.',
  'Playstation Theater': 'Closed 2019 (was 1515 Broadway / Best Buy Theater). Mark closed?',
  'Theater / Venue': 'Placeholder junk record — not a real venue. Delete/merge candidate.',
  'Kit Kat Klub': 'In-show branding of the August Wilson Theatre during Cabaret (2024). Merge into August Wilson Theatre or keep as alias?',
  // can't place confidently by name — need a source before writing an address
  'Dorothy B. Williams Theatre': "Couldn't verify an address. Which org/building is this?",
  'Ed Schmidt Theater Company': "Couldn't verify an address.",
  'Francis J. Greenburger Mainstage': "Couldn't verify an address (which building?).",
  'Royal Family Performing Arts Space': "Couldn't verify an address confidently.",
  'Society Theater': "Ambiguous name — couldn't verify an address.",
  'The East Village Basement': "Couldn't verify an address."
}

function abbrState(state?: string): string | undefined {
  if (!state) return undefined
  const m: Record<string, string> = { 'New York': 'NY', 'California': 'CA', 'New Jersey': 'NJ' }
  return m[state] || state
}

// ZIP is at the END of a matched address; a 5-digit house number can appear
// earlier, so take the LAST 5-digit group.
function zipFrom(s?: string): string | undefined {
  const all = s?.match(/\b\d{5}\b/g)
  return all?.[all.length - 1]
}

// "TBD" (and similar) are placeholder addresses, not real ones. 101 venues
// carry "TBD" — treat them as unaddressed.
const PLACEHOLDER = /^(tbd|n\/?a|unknown|none|-|\.)$/i
function isRealAddress(addr: any): boolean {
  const s = String(addr ?? '').trim()
  return !!s && !PLACEHOLDER.test(s)
}

interface NomResult { lat: number; lng: number; address?: string; city?: string; state?: string; zip?: string; display: string }

async function nominatimLookup(query: string): Promise<NomResult | null> {
  try {
    const res = await axios.get(NOMINATIM_ENDPOINT, {
      params: { q: query, format: 'json', limit: 1, addressdetails: 1 },
      headers: { 'User-Agent': USER_AGENT, 'Accept-Language': 'en' },
      timeout: 15000
    })
    const hit = res.data?.[0]
    if (!hit) return null
    const lat = parseFloat(hit.lat), lng = parseFloat(hit.lon)
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
    const a = hit.address || {}
    const street = `${a.house_number ? a.house_number + ' ' : ''}${a.road || ''}`.trim()
    return {
      lat, lng,
      address: street || undefined,
      city: a.city || a.town || a.village || a.suburb || a.city_district || a.neighbourhood,
      state: abbrState(a.state),
      zip: a.postcode,
      display: hit.display_name
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.warn(`  [nominatim] failed for "${query}": ${msg}`)
    return null
  }
}

function inBounds(lat: number, lng: number, metro: keyof typeof METROS): boolean {
  const [minLat, maxLat, minLng, maxLng] = METROS[metro]
  return lat >= minLat && lat <= maxLat && lng >= minLng && lng <= maxLng
}

async function main() {
  await mongoose.connect(process.env.MONGODB_URL as string)
  console.log(`\n=== bulkVenueAddresses (${COMMIT ? 'COMMIT — WRITING' : 'DRY RUN'}) ===\n`)

  const all = await VenueModel.find({}).lean()
  const byName = new Map<string, any>()
  for (const v of all as any[]) if (!byName.has(v.name)) byName.set(v.name, v)
  const findByName = (n: string) => byName.get(n)

  const mergePlan: { srcId: string; src: string; tgtId: string; tgt: string; tgtHasAddr: boolean }[] = []
  const missing: string[] = []

  for (const [src, tgt] of Object.entries(MERGE_INTO_EXISTING)) {
    const s = findByName(src), t = findByName(tgt)
    if (!s) { missing.push(`MERGE src not found: ${src}`); continue }
    if (!t) { missing.push(`MERGE tgt not found: ${tgt} (for ${src})`); continue }
    mergePlan.push({ srcId: String(s._id), src, tgtId: String(t._id), tgt, tgtHasAddr: isRealAddress(t.address) })
  }

  const geocodeSurvivors: string[] = []
  for (const group of MERGE_GROUPS_NEW) {
    const [survivorName, ...rest] = group
    const survivor = findByName(survivorName)
    if (!survivor) { missing.push(`GROUP survivor not found: ${survivorName}`); continue }
    geocodeSurvivors.push(survivorName)
    for (const src of rest) {
      const s = findByName(src)
      if (!s) { missing.push(`GROUP src not found: ${src}`); continue }
      mergePlan.push({ srcId: String(s._id), src, tgtId: String(survivor._id), tgt: survivorName, tgtHasAddr: false })
    }
  }

  console.log(`--- MERGES (${mergePlan.length}) ---`)
  for (const m of mergePlan) {
    console.log(`  ${m.src}  ->  ${m.tgt}${m.tgtHasAddr ? '  [target already addressed]' : '  [survivor, will geocode]'}`)
  }
  if (COMMIT) {
    for (const m of mergePlan) {
      const r = await mergeVenueCore(m.srcId, m.tgtId)
      if (!r.ok) console.warn(`  merge failed ${m.src} -> ${m.tgt}: ${r.error}`)
    }
    console.log(`  merges applied.`)
  }

  // Backfill coords for addressed merge-targets missing a map pin — using the
  // target's OWN stored address, never its name.
  const written: string[] = []
  const flagged: string[] = []
  const coordFixed: string[] = []

  const addressedTargets = new Map<string, any>()
  for (const m of mergePlan) {
    if (!m.tgtHasAddr) continue
    const t = findByName(m.tgt)
    if (t && !(t.location?.coordinates?.length) && !addressedTargets.has(m.tgt)) addressedTargets.set(m.tgt, t)
  }
  console.log(`\n--- COORD BACKFILL for addressed merge-targets missing a pin (${addressedTargets.size}) ---`)
  for (const [name, t] of addressedTargets) {
    const composed = [t.address, t.city, t.state, t.zipCode].filter((p: any) => p && String(p).trim()).join(', ')
    let usedNom = false
    const g = await geocodeAddress(composed, { onNominatimFallback: async () => { usedNom = true; await sleep(THROTTLE_MS) } })
    if (usedNom) await sleep(THROTTLE_MS)
    if (!g) { flagged.push(`${name} — target address didn't geocode: "${composed}"`); console.log(`  ⚠︎ ${name}: no geocode for "${composed}"`); continue }
    console.log(`  ✓ ${name}: [${g.lat.toFixed(4)},${g.lng.toFixed(4)}] via ${g.provider} ("${composed}")`)
    coordFixed.push(name)
    if (COMMIT) await VenueModel.updateOne({ _id: t._id }, { $set: { location: { type: 'Point', coordinates: [g.lng, g.lat] } } })
  }

  // Give survivors + distinctive venues an address.
  const toGeocode = new Set<string>([...geocodeSurvivors, ...Object.keys(GEOCODE_BY_NAME)])
  console.log(`\n--- ADDRESS + GEOCODE (${toGeocode.size}) ---`)
  for (const name of toGeocode) {
    const spec = GEOCODE_BY_NAME[name]
    const metro: keyof typeof METROS = spec?.metro || 'NYC'
    let resolved: { address?: string; city?: string; state?: string; zip?: string; lat: number; lng: number } | null = null

    if (spec?.address) {
      // Known street address -> verify via Census (falls back to Nominatim).
      const composed = [spec.address, spec.city, spec.state].filter(Boolean).join(', ')
      let usedNom = false
      const g = await geocodeAddress(composed, { onNominatimFallback: async () => { usedNom = true; await sleep(THROTTLE_MS) } })
      if (usedNom) await sleep(THROTTLE_MS)
      if (g) resolved = { address: spec.address, city: spec.city, state: spec.state, zip: zipFrom(g.matchedAddress), lat: g.lat, lng: g.lng }
    } else {
      // Name-only fallback via Nominatim free-text.
      const nom = await nominatimLookup(spec?.nameQuery || `${name}, New York, NY`)
      await sleep(THROTTLE_MS)
      if (nom) resolved = { address: nom.address, city: nom.city, state: nom.state, zip: nom.zip, lat: nom.lat, lng: nom.lng }
    }

    if (!resolved) { flagged.push(`${name} — no geocode result`); console.log(`  ⚠︎ ${name}: no result`); continue }
    if (!inBounds(resolved.lat, resolved.lng, metro)) {
      flagged.push(`${name} — matched OUT OF ${metro} bounds (${resolved.lat.toFixed(3)},${resolved.lng.toFixed(3)})`)
      console.log(`  ⚠︎ ${name}: out-of-bounds (${resolved.lat.toFixed(3)},${resolved.lng.toFixed(3)})`)
      continue
    }
    console.log(`  ✓ ${name}: ${resolved.address || '(no street)'}, ${resolved.city || '?'}, ${resolved.state || '?'} ${resolved.zip || ''}  [${resolved.lat.toFixed(4)},${resolved.lng.toFixed(4)}]`)
    written.push(name)
    if (COMMIT) {
      const doc = findByName(name)
      if (doc) await VenueModel.updateOne({ _id: doc._id }, {
        $set: {
          ...(resolved.address ? { address: resolved.address } : {}),
          ...(resolved.city ? { city: resolved.city } : {}),
          ...(resolved.state ? { state: resolved.state } : {}),
          ...(resolved.zip ? { zipCode: resolved.zip } : {}),
          location: { type: 'Point', coordinates: [resolved.lng, resolved.lat] }
        }
      })
    }
  }

  console.log(`\n--- REVIEW (${Object.keys(REVIEW).length}) — needs your call, nothing written ---`)
  for (const [name, note] of Object.entries(REVIEW)) {
    const exists = findByName(name) ? '' : ' (record not found)'
    console.log(`  • ${name}${exists}: ${note}`)
  }

  if (missing.length) {
    console.log(`\n--- MAP MISMATCHES (${missing.length}) — names not found in DB ---`)
    missing.forEach(m => console.log(`  ! ${m}`))
  }

  console.log(`\n=== SUMMARY ===`)
  console.log(`  merges:          ${mergePlan.length}`)
  console.log(`  coord backfills: ${coordFixed.length}`)
  console.log(`  addressed+geo:   ${written.length}`)
  console.log(`  flagged:         ${flagged.length}`)
  flagged.forEach(f => console.log(`     - ${f}`))
  console.log(`  review (Tier4):  ${Object.keys(REVIEW).length}`)
  console.log(`  mode:            ${COMMIT ? 'COMMITTED' : 'DRY RUN (no writes)'}`)

  await mongoose.disconnect()
}

main().catch(e => { console.error(e); process.exit(1) })
