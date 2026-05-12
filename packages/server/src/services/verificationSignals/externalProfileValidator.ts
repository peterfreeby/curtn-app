import { ExternalProfilePlatform, IClaimRequest } from '../../entities/claimRequest/claimRequestModel'
import { PersonModel } from '../../entities/person/personModel'

// Phase 8 — External profile validator.
//
// Validates URL structure for known platforms. For Wikidata Person targets
// we optionally cross-check the Q-number's name against the claimed Person's
// display name (exact match only in v1). Other platforms record the URL
// without external verification (OAuth deferred to v2).

export interface ValidationResult {
  ok: boolean
  platform?: ExternalProfilePlatform
  error?: string
  wikidataId?: string // when wikidata cross-check succeeds
}

const PATTERNS: Array<{ platform: ExternalProfilePlatform; re: RegExp }> = [
  { platform: 'imdb-pro', re: /^https?:\/\/(www\.)?(pro\.imdb\.com|imdbpro\.com)\/name\// },
  { platform: 'wikidata', re: /^https?:\/\/(www\.)?wikidata\.org\/wiki\/Q\d+/ },
  { platform: 'spotify-artist', re: /^https?:\/\/(open\.)?spotify\.com\/artist\/[A-Za-z0-9]+/ },
  { platform: 'wikipedia', re: /^https?:\/\/[a-z]{2,3}\.wikipedia\.org\/wiki\// },
]

export function detectPlatform(url: string): ExternalProfilePlatform | null {
  for (const p of PATTERNS) {
    if (p.re.test(url)) return p.platform
  }
  return null
}

function extractWikidataQ(url: string): string | null {
  const m = url.match(/wikidata\.org\/wiki\/(Q\d+)/)
  return m ? m[1] : null
}

// Lightweight Wikidata cross-check using the Wikipedia REST summary, which
// includes the underlying Wikidata ID. We don't want to import a heavy SPARQL
// path here — that lives in services/wikidata/api.ts and is intentionally
// reserved for batch crawlers. v1 cross-check: name string compare only.
async function wikidataNameMatchesPerson(
  qId: string,
  personName: string
): Promise<{ matched: boolean; foundLabel?: string }> {
  // Use the Wikipedia summary endpoint (faster than SPARQL). We fetch by the
  // Q-id using Wikipedia's special:redirect path — wikidata.org doesn't
  // expose a JSON-friendly label endpoint without auth, but Wikipedia's
  // summary API resolves cross-language items.
  // To keep this dependency-light, hit the Wikidata entity API directly.
  const axios = require('axios')
  try {
    const res = await axios.get(`https://www.wikidata.org/wiki/Special:EntityData/${qId}.json`, {
      headers: { 'User-Agent': 'CurtnBot/1.0 (https://curtn.com; hello@curtn.com)' },
      timeout: 10000,
    })
    const entity = res.data?.entities?.[qId]
    if (!entity) return { matched: false }
    const enLabel: string | undefined = entity.labels?.en?.value
    const aliases: string[] = (entity.aliases?.en ?? []).map((a: any) => a.value)
    const candidates = [enLabel, ...aliases].filter(Boolean) as string[]
    const norm = (s: string) => s.toLowerCase().trim()
    const target = norm(personName)
    if (candidates.some((c) => norm(c) === target)) {
      return { matched: true, foundLabel: enLabel }
    }
    return { matched: false, foundLabel: enLabel }
  } catch {
    return { matched: false }
  }
}

export async function validateExternalProfile(
  claim: IClaimRequest,
  url: string,
  declaredPlatform?: ExternalProfilePlatform
): Promise<ValidationResult> {
  if (!url || !/^https?:\/\//i.test(url)) {
    return { ok: false, error: 'URL must start with http:// or https://' }
  }
  const detected = detectPlatform(url)
  const platform = declaredPlatform ?? detected ?? 'other'

  if (platform !== 'other' && detected && declaredPlatform && declaredPlatform !== detected) {
    return { ok: false, error: `URL doesn't match the declared platform (${declaredPlatform})` }
  }
  if (platform !== 'other' && !detected) {
    return { ok: false, error: `URL does not match known ${platform} pattern` }
  }

  // Wikidata cross-check for Person targets.
  if (platform === 'wikidata' && claim.target?.kind === 'person') {
    const qId = extractWikidataQ(url)
    if (!qId) return { ok: false, error: 'Wikidata URL must contain a Q-number' }
    const person: any = await PersonModel.findById(claim.target.id).select('name').lean()
    if (!person) return { ok: false, error: 'Person not found' }
    const { matched, foundLabel } = await wikidataNameMatchesPerson(qId, person.name)
    if (!matched) {
      return {
        ok: false,
        error: `Wikidata entry ${qId}${foundLabel ? ` ("${foundLabel}")` : ''} doesn't match the claimed person name "${person.name}"`,
        platform,
        wikidataId: qId,
      }
    }
    return { ok: true, platform, wikidataId: qId }
  }

  return { ok: true, platform }
}
