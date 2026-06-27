import '../config/env'
import mongoose from 'mongoose'
import { DataSourceModel } from '../entities/dataSource/dataSourceModel'
import { UserModel } from '../entities/user/userModel'
import type { ScraperDataSourceConfig } from '../services/scraping/types'

// One-shot: create the DataSource for BroadwayDirect — the unifying Broadway
// source covering Shubert / ATG / Nederlander / Disney houses in one scraper.
// Tier 3 (code): see src/services/scraping/scrapers/broadwayDirect.ts for the
// listing → detail → weekly-pattern fan-out logic and venue attribution.
//
// No rowDefaults.venueName: each row carries its own venueName (read from the
// show's detail page), so shows land on their correct Venue records. maxItems is
// raised well above the 500 default because the per-performance fan-out produces
// thousands of dated rows across ~38 currently-playing shows.

const CONFIG: ScraperDataSourceConfig = {
  startUrl: 'https://broadwaydirect.com/shows/',
  strategy: { mode: 'code', scraperId: 'broadway-direct' },
  waitFor: '.farlo-card',
  maxItems: 8000
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
      existing.name = 'BroadwayDirect (broadwaydirect.com)'
      existing.config = CONFIG as unknown as Record<string, any>
      existing.consecutiveFailures = 0
      existing.disabledReason = undefined
      existing.isActive = true
      await existing.save()
      console.log('Updated BroadwayDirect DataSource:', existing._id.toString())
      return
    }

    const ds = await DataSourceModel.create({
      name: 'BroadwayDirect (broadwaydirect.com)',
      type: 'scraper',
      url: CONFIG.startUrl,
      config: CONFIG as unknown as Record<string, any>,
      // No associatedVenue: this source spans ~36 Broadway houses. Rows attribute
      // themselves via per-row venueName, matched to Venues at review time.
      createdBy: admin._id,
      isActive: true,
      consecutiveFailures: 0,
      cooldownHours: 24
    })
    console.log('Created BroadwayDirect DataSource:', ds._id.toString())
  } finally {
    await mongoose.disconnect()
  }
}

main().catch(err => { console.error(err); process.exit(1) })
