import type { VenueScraper } from './types'

// Tier 3 scraper registry — code modules for sites that don't fit JSON-LD or template extraction.
// Add entries here as we build hand-coded scrapers.
export const scraperRegistry: Record<string, VenueScraper> = {}

export function getScraper(id: string): VenueScraper | undefined {
  return scraperRegistry[id]
}
