import '../config/env'
import mongoose from 'mongoose'
import { DataSourceModel } from '../entities/dataSource/dataSourceModel'
import { UserModel } from '../entities/user/userModel'
import { VenueModel } from '../entities/venue/venueModel'
import type { ScraperDataSourceConfig } from '../services/scraping/types'

// Tier 1 (JSON-LD) — Center for Performance Research (CPR), Williamsburg Brooklyn.
// probeSeedList found 1 Event at /events/* — single-show page at probe time.
// Experimental performance and dance studio space on Manhattan Ave.

const CONFIG: ScraperDataSourceConfig = {
  startUrl: 'https://cprnyc.org/events/',
  strategy: { mode: 'json-ld' },
  rowDefaults: {
    venueName: 'Center for Performance Research',
    venueAddress: '361 Manhattan Ave',
    venueCity: 'Brooklyn',
    venueState: 'NY',
    venueZipCode: '11211'
  }
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
      existing.name = 'Center for Performance Research (cprnyc.org)'
      existing.config = CONFIG as unknown as Record<string, any>
      existing.consecutiveFailures = 0
      existing.disabledReason = undefined
      existing.isActive = true
      await existing.save()
      console.log('Updated CPR DataSource:', existing._id.toString())
      return
    }

    const venue = await VenueModel.findOne({ name: { $regex: /center for performance research/i } })

    const ds = await DataSourceModel.create({
      name: 'Center for Performance Research (cprnyc.org)',
      type: 'scraper',
      url: CONFIG.startUrl,
      config: CONFIG as unknown as Record<string, any>,
      associatedVenue: venue?._id,
      createdBy: admin._id,
      isActive: true,
      consecutiveFailures: 0,
      cooldownHours: 24
    })
    console.log('Created CPR DataSource:', ds._id.toString())
  } finally {
    await mongoose.disconnect()
  }
}

main().catch(err => { console.error(err); process.exit(1) })
