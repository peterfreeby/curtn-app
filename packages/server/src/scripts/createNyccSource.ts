import '../config/env'
import mongoose from 'mongoose'
import { DataSourceModel } from '../entities/dataSource/dataSourceModel'
import { UserModel } from '../entities/user/userModel'
import { VenueModel } from '../entities/venue/venueModel'
import type { ScraperDataSourceConfig } from '../services/scraping/types'

// Tier 1 (JSON-LD) — New York Comedy Club.
// Validated 2026-05-13 via validateTier1Sources.ts: 500 valid rows, 100% fill
// on title/date/time/ticketUrl/showImageUrl/showDescription/venue address,
// 98% personName as actual cast members. Gold standard for JSON-LD venues —
// no rowDefaults or template work needed.

const CONFIG: ScraperDataSourceConfig = {
  startUrl: 'https://newyorkcomedyclub.com/calendar',
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
      existing.name = 'New York Comedy Club (newyorkcomedyclub.com)'
      existing.config = CONFIG as unknown as Record<string, any>
      existing.consecutiveFailures = 0
      existing.disabledReason = undefined
      existing.isActive = true
      await existing.save()
      console.log('Updated NYCC DataSource:', existing._id.toString())
      return
    }

    const venue = await VenueModel.findOne({ name: { $regex: /^new york comedy club$/i } })

    const ds = await DataSourceModel.create({
      name: 'New York Comedy Club (newyorkcomedyclub.com)',
      type: 'scraper',
      url: CONFIG.startUrl,
      config: CONFIG as unknown as Record<string, any>,
      associatedVenue: venue?._id,
      createdBy: admin._id,
      isActive: true,
      consecutiveFailures: 0,
      cooldownHours: 24
    })
    console.log('Created NYCC DataSource:', ds._id.toString())
  } finally {
    await mongoose.disconnect()
  }
}

main().catch(err => { console.error(err); process.exit(1) })
