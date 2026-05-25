import '../config/env'
import mongoose from 'mongoose'
import { DataSourceModel } from '../entities/dataSource/dataSourceModel'
import { UserModel } from '../entities/user/userModel'
import { VenueModel } from '../entities/venue/venueModel'
import type { ScraperDataSourceConfig } from '../services/scraping/types'

// Tier 1 (JSON-LD) — New Group, resident at Pershing Square Signature Center.
// probeSeedList found 1 Event at /events/* — single-show page at probe time.
// The New Group commissions new work and mounts it at the Signature Center
// (480 W 42nd St). rowDefaults set the Signature address since the JSON-LD
// is per-event and may not always include venue schema.

const CONFIG: ScraperDataSourceConfig = {
  startUrl: 'https://www.thenewgroup.org/events/',
  strategy: { mode: 'json-ld' },
  rowDefaults: {
    venueName: 'New Group',
    venueAddress: '480 W 42nd St',
    venueCity: 'New York',
    venueState: 'NY',
    venueZipCode: '10036'
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
      existing.name = 'New Group (thenewgroup.org)'
      existing.config = CONFIG as unknown as Record<string, any>
      existing.consecutiveFailures = 0
      existing.disabledReason = undefined
      existing.isActive = true
      await existing.save()
      console.log('Updated New Group DataSource:', existing._id.toString())
      return
    }

    const venue = await VenueModel.findOne({ name: { $regex: /new group/i } })

    const ds = await DataSourceModel.create({
      name: 'New Group (thenewgroup.org)',
      type: 'scraper',
      url: CONFIG.startUrl,
      config: CONFIG as unknown as Record<string, any>,
      associatedVenue: venue?._id,
      createdBy: admin._id,
      isActive: true,
      consecutiveFailures: 0,
      cooldownHours: 24
    })
    console.log('Created New Group DataSource:', ds._id.toString())
  } finally {
    await mongoose.disconnect()
  }
}

main().catch(err => { console.error(err); process.exit(1) })
