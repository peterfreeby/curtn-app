import * as fs from 'fs/promises'
import * as path from 'path'
import * as crypto from 'crypto'

// Disk cache for rendered HTML. Probes and template authoring read from cache
// when iterating on the same URL repeatedly, so we don't pound venue sites.
//
// Cache lives at <repo-root>/packages/server/.scrape-cache/<sha256(url)>.json.
// Entries include url + fetchedAt so we can show the user when content is stale.

const CACHE_DIR = path.resolve(__dirname, '../../../.scrape-cache')
const DEFAULT_MAX_AGE_MS = 24 * 60 * 60 * 1000 // 24h

export interface CacheEntry {
  url: string
  fetchedAt: string // ISO timestamp
  html: string
}

function keyForUrl(url: string): string {
  return crypto.createHash('sha256').update(url).digest('hex').slice(0, 32)
}

function pathForUrl(url: string): string {
  return path.join(CACHE_DIR, `${keyForUrl(url)}.json`)
}

async function ensureDir(): Promise<void> {
  await fs.mkdir(CACHE_DIR, { recursive: true })
}

export async function readCache(
  url: string,
  opts: { maxAgeMs?: number } = {}
): Promise<CacheEntry | null> {
  const maxAgeMs = opts.maxAgeMs ?? DEFAULT_MAX_AGE_MS
  try {
    const raw = await fs.readFile(pathForUrl(url), 'utf8')
    const entry = JSON.parse(raw) as CacheEntry
    const ageMs = Date.now() - new Date(entry.fetchedAt).getTime()
    if (ageMs > maxAgeMs) return null
    return entry
  } catch {
    return null
  }
}

export async function writeCache(url: string, html: string): Promise<void> {
  await ensureDir()
  const entry: CacheEntry = {
    url,
    fetchedAt: new Date().toISOString(),
    html
  }
  await fs.writeFile(pathForUrl(url), JSON.stringify(entry), 'utf8')
}

export async function clearCache(url?: string): Promise<number> {
  if (url) {
    try {
      await fs.unlink(pathForUrl(url))
      return 1
    } catch {
      return 0
    }
  }
  try {
    const files = await fs.readdir(CACHE_DIR)
    let removed = 0
    for (const f of files) {
      if (f.endsWith('.json')) {
        await fs.unlink(path.join(CACHE_DIR, f))
        removed++
      }
    }
    return removed
  } catch {
    return 0
  }
}

export function cachePath(): string {
  return CACHE_DIR
}
