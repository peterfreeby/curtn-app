import '../config/env'
import mongoose from 'mongoose'
import { DataSourceModel } from '../entities/dataSource/dataSourceModel'
import { UserModel } from '../entities/user/userModel'
import { VenueModel } from '../entities/venue/venueModel'
import type { ScraperDataSourceConfig } from '../services/scraping/types'

// Tier 1 (JSON-LD) — Crooners Lounge & Supper Club, Fridley MN.
// probeSeedList found 12 Events on the programming page. Two stages: Main Stage
// and Dunsmore Room. MSP's premier cabaret/jazz venue.

const CONFIG: ScraperDataSourceConfig = {
  startUrl: 'https://croonersloungemn.com/',
  strategy: { mode: 'json-ld' },
  rowDefaults: {
    venueName: 'Crooners Lounge & Supper Club',
    venueAddress: '6161 NE Highway 65',
    venueCity: 'Fridley',
    venueState: 'MN',
    venueZipCode: '55432',
    performanceTypes: 'cabaret'
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
      existing.name = 'Crooners Lounge (croonersloungemn.com)'
      existing.config = CONFIG as unknown as Record<string, any>
      existing.consecutiveFailures = 0
      existing.disabledReason = undefined
      existing.isActive = true
      await existing.save()
      console.log('Updated Crooners DataSource:', existing._id.toString())
      return
    }

    const venue = await VenueModel.findOne({ name: { $regex: /crooners/i } })

    const ds = await DataSourceModel.create({
      name: 'Crooners Lounge (croonersloungemn.com)',
      type: 'scraper',
      url: CONFIG.startUrl,
      config: CONFIG as unknown as Record<string, any>,
      associatedVenue: venue?._id,
      createdBy: admin._id,
      isActive: true,
      consecutiveFailures: 0,
      cooldownHours: 24
    })
    console.log('Created Crooners DataSource:', ds._id.toString())
  } finally {
    await mongoose.disconnect()
  }
}

main().catch(err => { console.error(err); process.exit(1) })
