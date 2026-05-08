import * as fs from 'fs/promises'
import * as path from 'path'
import * as crypto from 'crypto'
import type { CsvRowInput } from '../importEngine'

// Detail-page extraction cache. Keyed by (detailUrl, listingFingerprint) so we
// only refetch a per-event detail page when its listing-row data changes.
//
// Why a fingerprint and not just URL? Caveat reuses URLs for different events
// when an event repeats. Hashing in the listing row's title+date means we
// refetch automatically when something material changed about the show.
//
// 7-day TTL by default — generous because event content rarely changes after
// publish, and the politeness savings compound across nightly runs.

const CACHE_DIR = path.resolve(__dirname, '../../../.scrape-cache/detail')
const DEFAULT_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000 // 7 days

export interface DetailCacheEntry {
  detailUrl: string
  fingerprint: string
  fields: Partial<CsvRowInput>
  fetchedAt: string
}

function keyFor(detailUrl: string, fingerprint: string): string {
  return crypto
    .createHash('sha256')
    .update(`${detailUrl}|${fingerprint}`)
    .digest('hex')
    .slice(0, 32)
}

function pathFor(detailUrl: string, fingerprint: string): string {
  return path.join(CACHE_DIR, `${keyFor(detailUrl, fingerprint)}.json`)
}

async function ensureDir(): Promise<void> {
  await fs.mkdir(CACHE_DIR, { recursive: true })
}

export async function readDetailCache(
  detailUrl: string,
  fingerprint: string,
  opts: { maxAgeMs?: number } = {}
): Promise<DetailCacheEntry | null> {
  const maxAgeMs = opts.maxAgeMs ?? DEFAULT_MAX_AGE_MS
  try {
    const raw = await fs.readFile(pathFor(detailUrl, fingerprint), 'utf8')
    const entry = JSON.parse(raw) as DetailCacheEntry
    const ageMs = Date.now() - new Date(entry.fetchedAt).getTime()
    if (ageMs > maxAgeMs) return null
    return entry
  } catch {
    return null
  }
}

export async function writeDetailCache(
  detailUrl: string,
  fingerprint: string,
  fields: Partial<CsvRowInput>
): Promise<void> {
  await ensureDir()
  const entry: DetailCacheEntry = {
    detailUrl,
    fingerprint,
    fields,
    fetchedAt: new Date().toISOString()
  }
  await fs.writeFile(pathFor(detailUrl, fingerprint), JSON.stringify(entry), 'utf8')
}

// Compute a stable fingerprint from a row's listing-extracted fields. The
// orchestrator decides which fields to include — defaults to title+date,
// which catches "the show changed" without thrashing on cosmetic edits
// (e.g., listing description got truncated differently).
export function computeFingerprint(
  row: Partial<CsvRowInput>,
  fields: string[] = ['title', 'date']
): string {
  const parts = fields.map(f => String((row as any)[f] ?? '')).join('|')
  return crypto.createHash('sha256').update(parts).digest('hex').slice(0, 16)
}

export async function clearDetailCache(): Promise<number> {
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
