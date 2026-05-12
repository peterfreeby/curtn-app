import { randomBytes } from 'crypto'
import { resolveTxt } from 'dns/promises'
import { IClaimRequest } from '../../entities/claimRequest/claimRequestModel'
import { VenueModel } from '../../entities/venue/venueModel'
import { fetchPage } from '../pageFetcher/fetchPage'

// Phase 8 — Webmaster verification.
//
// Two paths:
// 1. Meta tag: claimant adds `<meta name="curtn-verify" content="<token>">`
//    to any page on the unit's primary website.
// 2. DNS TXT record: claimant adds `curtn-verify=<token>` to the website
//    domain's TXT records.
//
// Either path → 100 points → sufficient alone for auto-promotion.

const TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000 // 7 days

export function generateWebmasterToken(): { token: string; expiresAt: Date } {
  const token = randomBytes(16).toString('hex')
  const expiresAt = new Date(Date.now() + TOKEN_TTL_MS)
  return { token, expiresAt }
}

// Extract <meta name="curtn-verify" content="..."> regardless of attribute
// order or quote style. Returns the content string or null.
export function extractCurtnVerifyMeta(html: string): string | null {
  // name=... before content=...
  let re = /<meta\s+[^>]*name=["']curtn-verify["'][^>]*content=["']([^"']+)["'][^>]*>/i
  let m = html.match(re)
  if (m) return m[1]
  // content=... before name=...
  re = /<meta\s+[^>]*content=["']([^"']+)["'][^>]*name=["']curtn-verify["'][^>]*>/i
  m = html.match(re)
  if (m) return m[1]
  return null
}

export interface VerifyResult {
  verified: boolean
  method?: 'meta' | 'txt'
  error?: string
}

// Strip protocol/path; return apex/registered hostname for DNS TXT lookups.
export function extractHostname(url: string): string | null {
  try {
    const u = new URL(url.startsWith('http') ? url : `https://${url}`)
    return u.hostname
  } catch {
    return null
  }
}

export async function verifyWebmasterToken(
  websiteUrl: string,
  token: string
): Promise<VerifyResult> {
  // Try the meta-tag path first (fast, single fetch).
  let metaError: string | undefined
  try {
    const html = await fetchPage(websiteUrl)
    const found = extractCurtnVerifyMeta(html)
    if (found && found === token) return { verified: true, method: 'meta' }
    if (found && found !== token) metaError = 'Meta tag present but token does not match'
  } catch (err: any) {
    metaError = `Could not fetch page: ${err?.message ?? String(err)}`
  }

  // Fall back to DNS TXT.
  const host = extractHostname(websiteUrl)
  if (host) {
    try {
      const records = await resolveTxt(host)
      const flat = records.flat() // resolveTxt returns string[][]
      const expected = `curtn-verify=${token}`
      if (flat.some((r) => r.trim() === expected)) {
        return { verified: true, method: 'txt' }
      }
    } catch {
      // ignore — TXT lookup miss is normal when claimant chose meta path
    }
  }

  return {
    verified: false,
    error: metaError ?? 'Neither meta tag nor TXT record matched the issued token',
  }
}

// Convenience: resolve the website URL for a claim's target unit. Only
// Venues currently have a `website` field in Curtn; Person and
// ProductionCompany don't. Callers should surface a clear error when no
// website is available.
export async function getWebsiteForClaim(claim: IClaimRequest): Promise<string | null> {
  if (!claim.target?.kind || !claim.target?.id) return null
  if (claim.target.kind === 'venue') {
    const v: any = await VenueModel.findById(claim.target.id).select('website').lean()
    return v?.website ?? null
  }
  return null
}
