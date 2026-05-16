import '../config/env'
import mongoose from 'mongoose'
import { DataSourceModel } from '../entities/dataSource/dataSourceModel'
import { UserModel } from '../entities/user/userModel'
import { VenueModel } from '../entities/venue/venueModel'
import type { ScraperDataSourceConfig } from '../services/scraping/types'

// Tier 1 (JSON-LD) — The Tiny Cupboard (Bushwick comedy room).
// probeSeedList found 117 ComedyEvents on /calendar. Expected to follow the
// same gold-standard structure as New York Comedy Club. Validate output via
// runScraper.ts --dry-run before promoting to active scrape cadence.

const CONFIG: ScraperDataSourceConfig = {
  startUrl: 'https://www.thetinycupboard.com/calendar',
  strategy: { mode: 'json-ld' }
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
      existing.name = 'The Tiny Cupboard (thetinycupboard.com)'
      existing.config = CONFIG as unknown as Record<string, any>
      existing.consecutiveFailures = 0
      existing.disabledReason = undefined
      existing.isActive = true
      await existing.save()
      console.log('Updated Tiny Cupboard DataSource:', existing._id.toString())
      return
    }

    const venue = await VenueModel.findOne({ name: { $regex: /tiny cupboard/i } })

    const ds = await DataSourceModel.create({
      name: 'The Tiny Cupboard (thetinycupboard.com)',
      type: 'scraper',
      url: CONFIG.startUrl,
      config: CONFIG as unknown as Record<string, any>,
      associatedVenue: venue?._id,
      createdBy: admin._id,
      isActive: true,
      consecutiveFailures: 0,
      cooldownHours: 24
    })
    console.log('Created Tiny Cupboard DataSource:', ds._id.toString())
  } finally {
    await mongoose.disconnect()
  }
}

main().catch(err => { console.error(err); process.exit(1) })
