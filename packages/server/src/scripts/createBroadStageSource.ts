import '../config/env'
import mongoose from 'mongoose'
import { DataSourceModel } from '../entities/dataSource/dataSourceModel'
import { UserModel } from '../entities/user/userModel'
import { VenueModel } from '../entities/venue/venueModel'
import type { ScraperDataSourceConfig } from '../services/scraping/types'

// The Broad Stage, Santa Monica (broadstage.org) — Tier 3 (code).
// The 2026/27 season page lists 34 cards (title + date + detail URL + poster),
// but the show description can't be templated: detail pages ship no
// og:description and the synopsis is an unclassed <p> at a varying position, and
// the card dates use un-spaced ASCII hyphen ranges the shared parseDateRange
// mis-reads. Both are handled in src/services/scraping/scrapers/broadStage.ts.

const CONFIG: ScraperDataSourceConfig = {
  startUrl: 'https://broadstage.org/2627-season/',
  strategy: { mode: 'code', scraperId: 'broad-stage' },
  waitFor: '.item',
  rowDefaults: {
    venueName: 'The Broad Stage',
    venueAddress: '1310 11th St',
    venueCity: 'Santa Monica',
    venueState: 'CA',
    venueZipCode: '90401',
    performanceTypes: 'music'
  },
  maxItems: 50
}

async function main() {
  const mongoUrl = process.env.MONGODB_URL
  if (!mongoUrl) throw new Error('MONGODB_URL not set')
  await mongoose.connect(mongoUrl)

  try {
    const admin = await UserModel.findOne({ isAdmin: true })
    if (!admin) throw new Error('No admin user found — run setAdmin first')

    const existing = await DataSourceModel.findOne({ type: 'scraper', url: CONFIG.startUrl })
    if (existing) {
      existing.config = CONFIG
      existing.consecutiveFailures = 0
      existing.disabledReason = undefined
      existing.isActive = true
      await existing.save()
      console.log('Updated existing Broad Stage DataSource:', existing._id.toString())
      return
    }

    const venue = await VenueModel.findOne({ name: { $regex: /broad\s*stage/i } })
    const ds = await DataSourceModel.create({
      name: 'The Broad Stage (broadstage.org)',
      type: 'scraper',
      purpose: 'scraper',
      url: CONFIG.startUrl,
      config: CONFIG,
      associatedVenue: venue?._id,
      createdBy: admin._id,
      isActive: true,
      consecutiveFailures: 0,
      cooldownHours: 24
    })
    console.log('Created Broad Stage DataSource:', ds._id.toString())
    if (venue) console.log('  associated with venue:', venue._id.toString(), `(${venue.name})`)
    else console.log('  no existing Broad Stage venue found — scraper will create one on first run')
  } finally {
    await mongoose.disconnect()
  }
}

main().catch(err => { console.error(err); process.exit(1) })
