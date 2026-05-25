import '../config/env'
import mongoose from 'mongoose'
import { DataSourceModel } from '../entities/dataSource/dataSourceModel'
import { UserModel } from '../entities/user/userModel'
import { VenueModel } from '../entities/venue/venueModel'
import type { ScraperDataSourceConfig } from '../services/scraping/types'

// Tier 1 (JSON-LD) — Laugh Factory, Sunset Strip LA.
// probeSeedList found 1 Event at root — weak signal at probe time. Full calendar
// is likely at /shows/ or similar; start at root and let the JSON-LD extractor
// find whatever schema is present. Reassess if dry-run yields 0 rows.

const CONFIG: ScraperDataSourceConfig = {
  startUrl: 'https://www.laughfactory.com/',
  strategy: { mode: 'json-ld' },
  rowDefaults: {
    venueName: 'Laugh Factory',
    venueAddress: '8001 Sunset Blvd',
    venueCity: 'West Hollywood',
    venueState: 'CA',
    venueZipCode: '90046',
    performanceTypes: 'comedy'
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
      existing.name = 'Laugh Factory (laughfactory.com)'
      existing.config = CONFIG as unknown as Record<string, any>
      existing.consecutiveFailures = 0
      existing.disabledReason = undefined
      existing.isActive = true
      await existing.save()
      console.log('Updated Laugh Factory DataSource:', existing._id.toString())
      return
    }

    const venue = await VenueModel.findOne({ name: { $regex: /laugh factory/i } })

    const ds = await DataSourceModel.create({
      name: 'Laugh Factory (laughfactory.com)',
      type: 'scraper',
      url: CONFIG.startUrl,
      config: CONFIG as unknown as Record<string, any>,
      associatedVenue: venue?._id,
      createdBy: admin._id,
      isActive: true,
      consecutiveFailures: 0,
      cooldownHours: 24
    })
    console.log('Created Laugh Factory DataSource:', ds._id.toString())
  } finally {
    await mongoose.disconnect()
  }
}

main().catch(err => { console.error(err); process.exit(1) })
