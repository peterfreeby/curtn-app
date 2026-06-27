import type { VenueScraper } from './types'
import { broadStageScraper } from './scrapers/broadStage'

// Tier 3 scraper registry — code modules for sites that don't fit JSON-LD or template extraction.
// Add entries here as we build hand-coded scrapers.
export const scraperRegistry: Record<string, VenueScraper> = {
  [broadStageScraper.id]: broadStageScraper
}

export function getScraper(id: string): VenueScraper | undefined {
  return scraperRegistry[id]
}
