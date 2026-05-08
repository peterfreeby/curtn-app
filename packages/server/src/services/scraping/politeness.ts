// Per-host rate limiting, jitter, robots.txt parsing, and the user agent we
// present to the world. These are the guardrails between an honest internal
// bootstrap tool and a fragile arts-nonprofit site we accidentally hammer.

export const USER_AGENT =
  'CurtnBot/1.0 (+https://curtn.com; hello@curtn.com — internal archive bootstrap, contact for opt-out)'

const DEFAULT_MIN_DELAY_MS = 5_000
const DEFAULT_JITTER_MS = 5_000

const lastFetchByHost = new Map<string, number>()

function hostOf(url: string): string {
  try {
    return new URL(url).host
  } catch {
    return url
  }
}

function jitter(maxMs: number): number {
  return Math.floor(Math.random() * maxMs)
}

// Block until enough time has passed since the last request to this host.
// Records the exit timestamp so a caller doing back-to-back fetches stays
// spaced even if they don't await between schedule + execute.
export async function awaitPoliteWindow(
  url: string,
  opts: { minDelayMs?: number; jitterMs?: number } = {}
): Promise<void> {
  const minDelayMs = opts.minDelayMs ?? DEFAULT_MIN_DELAY_MS
  const jitterMs = opts.jitterMs ?? DEFAULT_JITTER_MS
  const host = hostOf(url)
  const last = lastFetchByHost.get(host)
  if (last !== undefined) {
    const elapsed = Date.now() - last
    const target = minDelayMs + jitter(jitterMs)
    if (elapsed < target) {
      await new Promise(resolve => setTimeout(resolve, target - elapsed))
    }
  }
  lastFetchByHost.set(host, Date.now())
}

// Minimal robots.txt parser. Honors User-Agent matching (exact match or '*'
// fallback) and Disallow rules. Does not handle Allow precedence — for our
// politeness use case, a single Disallow that matches the path is enough to
// skip. Returns { allowed, reason } so callers can log the verdict.
export interface RobotsVerdict {
  allowed: boolean
  reason: string
}

interface RobotsRule {
  userAgent: string
  disallows: string[]
  crawlDelayMs?: number
}

function parseRobots(text: string): RobotsRule[] {
  const rules: RobotsRule[] = []
  let current: RobotsRule | null = null
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.replace(/#.*$/, '').trim()
    if (!line) continue
    const match = line.match(/^([a-zA-Z-]+):\s*(.*)$/)
    if (!match) continue
    const [, key, value] = match
    const k = key.toLowerCase()
    if (k === 'user-agent') {
      if (!current || current.disallows.length > 0 || current.crawlDelayMs !== undefined) {
        current = { userAgent: value.toLowerCase(), disallows: [] }
        rules.push(current)
      } else {
        // Stack consecutive User-Agent lines into the same group
        current.userAgent = value.toLowerCase()
      }
    } else if (k === 'disallow' && current) {
      if (value) current.disallows.push(value)
    } else if (k === 'crawl-delay' && current) {
      const seconds = parseFloat(value)
      if (!isNaN(seconds)) current.crawlDelayMs = seconds * 1000
    }
  }
  return rules
}

function pickRule(rules: RobotsRule[], userAgent: string): RobotsRule | undefined {
  const ua = userAgent.toLowerCase()
  // Prefer exact-prefix match (e.g., "curtnbot") over wildcard
  const specific = rules.find(r => r.userAgent !== '*' && ua.includes(r.userAgent))
  if (specific) return specific
  return rules.find(r => r.userAgent === '*')
}

function matchesDisallow(disallow: string, pathname: string): boolean {
  if (disallow === '/') return true
  if (!disallow) return false
  // Treat trailing-wildcard or simple prefix match
  return pathname.startsWith(disallow)
}

const robotsCache = new Map<string, RobotsRule[]>()

export async function checkRobots(
  url: string,
  userAgent: string = USER_AGENT
): Promise<RobotsVerdict> {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return { allowed: false, reason: 'invalid URL' }
  }
  const robotsUrl = `${parsed.protocol}//${parsed.host}/robots.txt`

  let rules = robotsCache.get(parsed.host)
  if (!rules) {
    const ac = new AbortController()
    const timer = setTimeout(() => ac.abort(), 5_000)
    try {
      const res = await fetch(robotsUrl, {
        headers: { 'User-Agent': userAgent },
        signal: ac.signal
      })
      if (!res.ok) {
        // No robots.txt or fetch failed — treat as allowed (RFC convention)
        rules = []
      } else {
        rules = parseRobots(await res.text())
      }
    } catch {
      rules = []
    } finally {
      clearTimeout(timer)
    }
    robotsCache.set(parsed.host, rules)
  }

  const rule = pickRule(rules, userAgent)
  if (!rule) return { allowed: true, reason: 'no matching robots rule' }

  for (const d of rule.disallows) {
    if (matchesDisallow(d, parsed.pathname)) {
      return {
        allowed: false,
        reason: `robots.txt disallows ${parsed.pathname} for ${rule.userAgent === '*' ? 'all bots' : rule.userAgent}`
      }
    }
  }
  return { allowed: true, reason: 'robots.txt permits' }
}

export function getCrawlDelayMs(host: string): number | undefined {
  const rules = robotsCache.get(host)
  if (!rules) return undefined
  const rule = pickRule(rules, USER_AGENT)
  return rule?.crawlDelayMs
}

// Test helper: clear in-process state so unit tests don't leak across cases.
export function _resetPolitenessState(): void {
  lastFetchByHost.clear()
  robotsCache.clear()
}
