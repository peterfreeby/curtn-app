// Open Graph fallback ingestion — rung 4 of the blocked-venue ladder.
// See Curtn_Obsidian/Reference/Handling Blocked Venues.md and
// Curtn_Obsidian/Projects/OG Fallback Ingestion (Facebook Graph API).md

export interface OpenGraphResult {
  url: string
  title?: string
  description?: string
  imageUrl?: string
  /** Raw scrape payload, kept for debugging / future field extraction. */
  raw: unknown
}

/**
 * Facebook's X-App-Usage header — each metric is a percentage (0-100) of the
 * app's rolling-hour budget. Throttling kicks in as any metric approaches 100.
 */
export interface AppUsage {
  callCount: number
  totalTime: number
  totalCpuTime: number
}

export interface FetchOpenGraphResult {
  og: OpenGraphResult
  usage?: AppUsage
}
