import type { AppUsage, FetchOpenGraphResult, OpenGraphResult } from './types'

// Graph API version. FB deprecates the oldest versions over time, so this is
// env-overridable — bump FB_GRAPH_VERSION if a call starts returning a
// "version deprecated" error.
const GRAPH_VERSION = process.env.FB_GRAPH_VERSION || 'v21.0'
const GRAPH_HOST = 'https://graph.facebook.com'

export class OgFetchError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
    public readonly fbCode?: number,
    /** True when this is a rate-limit / throttle response (governor should cool down + retry). */
    public readonly isRateLimit = false,
    /** App-usage parsed from the (possibly throttled) response, if present. */
    public readonly usage?: AppUsage
  ) {
    super(message)
    this.name = 'OgFetchError'
  }
}

// FB rate-limit / throttle signals: app(4)/user(17)/page(32) limits, custom
// rate limit (613), and the app-throttle subcode. HTTP 429 also counts.
const RATE_LIMIT_CODES = new Set([4, 17, 32, 613])
const RATE_LIMIT_SUBCODE = 2446079

function isRateLimitError(status: number, code?: number, subcode?: number, message?: string): boolean {
  if (status === 429) return true
  if (code !== undefined && RATE_LIMIT_CODES.has(code)) return true
  if (subcode === RATE_LIMIT_SUBCODE) return true
  return !!message && /rate limit|request limit reached|too many calls|reduce the amount/i.test(message)
}

/**
 * Resolve the Facebook app access token. We never store an OAuth token — the
 * app access token is simply `{App ID}|{App Secret}`, which is all the
 * URL-scrape endpoint needs. Reads FB_APP_ACCESS_TOKEN if set, else composes
 * it from FB_APP_ID + FB_APP_SECRET.
 */
export function getAppAccessToken(): string {
  const explicit = process.env.FB_APP_ACCESS_TOKEN
  if (explicit?.trim()) return explicit.trim()

  const id = process.env.FB_APP_ID?.trim()
  const secret = process.env.FB_APP_SECRET?.trim()
  if (!id || !secret) {
    throw new OgFetchError(
      'Missing Facebook app credentials. Set FB_APP_ID + FB_APP_SECRET (or FB_APP_ACCESS_TOKEN) in packages/server/.env'
    )
  }
  return `${id}|${secret}`
}

function parseAppUsage(headerValue: string | null): AppUsage | undefined {
  if (!headerValue) return undefined
  try {
    const j = JSON.parse(headerValue) as Record<string, number>
    return {
      callCount: Number(j.call_count ?? 0),
      totalTime: Number(j.total_time ?? 0),
      totalCpuTime: Number(j.total_cputime ?? 0)
    }
  } catch {
    return undefined
  }
}

/** Normalize the og:image, which FB returns as a string or an array of objects. */
function extractImageUrl(payload: Record<string, unknown>): string | undefined {
  const img = payload.image ?? (payload.og_object as Record<string, unknown> | undefined)?.image
  if (!img) return undefined
  if (typeof img === 'string') return img
  if (Array.isArray(img)) {
    const first = img[0]
    if (typeof first === 'string') return first
    if (first && typeof first === 'object' && 'url' in first) return String((first as { url: unknown }).url)
  }
  if (typeof img === 'object' && 'url' in (img as object)) return String((img as { url: unknown }).url)
  return undefined
}

function pick(payload: Record<string, unknown>, key: string): string | undefined {
  // Scrape responses put fields top-level; cached GET reads nest them under og_object.
  const top = payload[key]
  if (typeof top === 'string' && top.trim()) return top.trim()
  const og = payload.og_object as Record<string, unknown> | undefined
  const nested = og?.[key]
  if (typeof nested === 'string' && nested.trim()) return nested.trim()
  return undefined
}

/**
 * Ask Facebook's (IP-verified) crawler to scrape a URL and hand back the Open
 * Graph metadata it parsed. This is rung 4 of the blocked-venue ladder: it
 * reaches pages our own crawler can't, but yields only a stub (title /
 * description / image) — no dates, times, or cast.
 *
 * POST {host}/{version}/?id={url}&scrape=true&access_token={token}
 */
export async function fetchOpenGraph(url: string): Promise<FetchOpenGraphResult> {
  const token = getAppAccessToken()
  const endpoint = new URL(`${GRAPH_HOST}/${GRAPH_VERSION}/`)
  endpoint.searchParams.set('id', url)
  endpoint.searchParams.set('scrape', 'true')
  endpoint.searchParams.set('access_token', token)

  let res: Response
  try {
    res = await fetch(endpoint.toString(), { method: 'POST' })
  } catch (e) {
    throw new OgFetchError(`Network error fetching OG for ${url}: ${(e as Error).message}`)
  }

  const usage = parseAppUsage(res.headers.get('x-app-usage'))
  const bodyText = await res.text()

  let payload: Record<string, unknown>
  try {
    payload = JSON.parse(bodyText) as Record<string, unknown>
  } catch {
    throw new OgFetchError(`Non-JSON response (${res.status}) for ${url}: ${bodyText.slice(0, 200)}`, res.status)
  }

  if (!res.ok || payload.error) {
    const err = payload.error as { message?: string; code?: number; error_subcode?: number } | undefined
    const rateLimited = isRateLimitError(res.status, err?.code, err?.error_subcode, err?.message)
    throw new OgFetchError(
      `Graph API error for ${url}: ${err?.message ?? `HTTP ${res.status}`}`,
      res.status,
      err?.code,
      rateLimited,
      usage
    )
  }

  const og: OpenGraphResult = {
    url,
    title: pick(payload, 'title'),
    description: pick(payload, 'description'),
    imageUrl: extractImageUrl(payload),
    raw: payload
  }

  return { og, usage }
}

/**
 * Pacing helper for batch runs. Sleeps when any X-App-Usage metric approaches
 * the throttle ceiling, so a long run degrades gracefully instead of getting
 * hard-throttled. Returns the ms it slept (0 if under threshold).
 */
export async function backoffForUsage(usage: AppUsage | undefined, opts: { threshold?: number; sleepMs?: number } = {}): Promise<number> {
  const threshold = opts.threshold ?? 90
  const sleepMs = opts.sleepMs ?? 60_000
  if (!usage) return 0
  const peak = Math.max(usage.callCount, usage.totalTime, usage.totalCpuTime)
  if (peak < threshold) return 0
  await new Promise(r => setTimeout(r, sleepMs))
  return sleepMs
}
