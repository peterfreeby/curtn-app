import '../config/env'
import mongoose from 'mongoose'
import { DataSourceModel } from '../entities/dataSource/dataSourceModel'
import { UserModel } from '../entities/user/userModel'
import { VenueModel } from '../entities/venue/venueModel'
import type { ScraperDataSourceConfig } from '../services/scraping/types'

// Theatre for a New Audience (tfana.org) — Tier 3 (code). Site recovered from an
// HTTP 526 SSL error; season grid + event pages are JS-hydrated and the synopsis
// is unclassed <p> text, so extraction lives in
// src/services/scraping/scrapers/tfana.ts.

const CONFIG: ScraperDataSourceConfig = {
  startUrl: 'https://tfana.org/current-season/26-27-season',
  strategy: { mode: 'code', scraperId: 'tfana' },
  waitFor: 'a[href*="/events/"]',
  rowDefaults: {
    venueName: 'Polonsky Shakespeare Center',
    venueAddress: '262 Ashland Place',
    venueCity: 'Brooklyn',
    venueState: 'NY',
    venueZipCode: '11217',
    performanceTypes: 'theater'
  },
  maxItems: 30
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
      console.log('Updated existing TFANA DataSource:', existing._id.toString())
      return
    }

    const venue = await VenueModel.findOne({ name: { $regex: /new audience|polonsky/i } })
    const ds = await DataSourceModel.create({
      name: 'Theatre for a New Audience (tfana.org)',
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
    console.log('Created TFANA DataSource:', ds._id.toString())
    if (venue) console.log('  associated with venue:', venue._id.toString(), `(${venue.name})`)
    else console.log('  no existing TFANA venue found — scraper will create one on first run')
  } finally {
    await mongoose.disconnect()
  }
}

main().catch(err => { console.error(err); process.exit(1) })
