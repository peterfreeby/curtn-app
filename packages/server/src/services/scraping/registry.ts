import type { VenueScraper } from './types'
import { broadStageScraper } from './scrapers/broadStage'
import { tfanaScraper } from './scrapers/tfana'
import { bellHouseScraper } from './scrapers/bellHouse'
import { theaterlabScraper } from './scrapers/theaterlab'
import { comedyCellarScraper } from './scrapers/comedyCellar'

// Tier 3 scraper registry — code modules for sites that don't fit JSON-LD or template extraction.
// Add entries here as we build hand-coded scrapers.
export const scraperRegistry: Record<string, VenueScraper> = {
  [broadStageScraper.id]: broadStageScraper,
  [tfanaScraper.id]: tfanaScraper,
  [bellHouseScraper.id]: bellHouseScraper,
  [comedyCellarScraper.id]: comedyCellarScraper,
  [theaterlabScraper.id]: theaterlabScraper
}

export function getScraper(id: string): VenueScraper | undefined {
  return scraperRegistry[id]
}
