import '../config/env'
import mongoose from 'mongoose'
import { DataSourceModel } from '../entities/dataSource/dataSourceModel'
import { UserModel } from '../entities/user/userModel'
import { VenueModel } from '../entities/venue/venueModel'
import type { ScraperDataSourceConfig } from '../services/scraping/types'

// Tier 3 (code) — Comedy Cellar, New York (comedycellar.com).
// No JSON-LD and no server-rendered event DOM: the /new-york-line-up/ page is
// hydrated by the "comedy-lineup" WordPress plugin, which POSTs to /lineup/api/
// per date. The code scraper navigates to the lineup page, calls that API for
// each date the picker exposes, and parses the returned HTML blob into one
// event per time-slot show (cast = the night's comedians). Poster left empty
// on purpose — Curtn's title-card fallback covers it. See scrapers/comedyCellar.ts.

const CONFIG: ScraperDataSourceConfig = {
  startUrl: 'https://www.comedycellar.com/new-york-line-up/',
  strategy: { mode: 'code', scraperId: 'comedy-cellar' },
  // Cast fan-out over a multi-week horizon produces far more than the default
  // 500-row cap; raise it so the full horizon isn't truncated.
  maxItems: 6000,
  // No per-show poster art exists (only comedian headshots) — poster ships
  // null and Curtn's title-card fallback covers it. But we DO capture each
  // comedian's headshot (personHeadshotUrl) and rehost it to R2: they're
  // hotlinked from comedycellar.com (broken cross-origin) and are needed for
  // the planned headshot-mosaic poster variant. rehostImages now covers
  // personHeadshotUrl too (see services/images/rehostImage.ts).
  rehostImages: true
}

async function main() {
  const mongoUrl = process.env.MONGODB_URL
  if (!mongoUrl) throw new Error('MONGODB_URL not set')
  await mongoose.connect(mongoUrl)

  try {
    const admin = await UserModel.findOne({ isAdmin: true })
    if (!admin) throw new Error('No admin user found')

    const existing = await DataSourceModel.findOne({ type: 'scraper', url: CONFIG.startUrl })
    if (existing) {
      existing.name = 'Comedy Cellar (comedycellar.com)'
      existing.config = CONFIG as unknown as Record<string, any>
      existing.consecutiveFailures = 0
      existing.disabledReason = undefined
      existing.isActive = true
      await existing.save()
      console.log('Updated Comedy Cellar DataSource:', existing._id.toString())
      return
    }

    const venue = await VenueModel.findOne({ name: { $regex: /comedy cellar/i } })

    const ds = await DataSourceModel.create({
      name: 'Comedy Cellar (comedycellar.com)',
      type: 'scraper',
      url: CONFIG.startUrl,
      config: CONFIG as unknown as Record<string, any>,
      associatedVenue: venue?._id,
      createdBy: admin._id,
      isActive: true,
      consecutiveFailures: 0,
      cooldownHours: 24
    })
    console.log('Created Comedy Cellar DataSource:', ds._id.toString())
    if (venue) console.log('  associated with venue:', venue._id.toString(), `(${venue.name})`)
    else console.log('  no existing Comedy Cellar venue found — scraper will create one on first run')
  } finally {
    await mongoose.disconnect()
  }
}

main().catch(err => { console.error(err); process.exit(1) })
