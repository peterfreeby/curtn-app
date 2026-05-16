import '../config/env'
import mongoose from 'mongoose'
import { DataSourceModel } from '../entities/dataSource/dataSourceModel'
import { UserModel } from '../entities/user/userModel'
import { VenueModel } from '../entities/venue/venueModel'
import type { ScraperDataSourceConfig } from '../services/scraping/types'

// Tier 1 (JSON-LD) — Long Beach Playhouse.
// probeSeedList found 12 Events on /shows/. Validation (2026-05-13): 12/12
// valid rows, 100% on title/date/time/ticketUrl/showImageUrl/showDescription,
// but JSON-LD performer is "Organization" stub (not real cast) and the
// venue address isn't included in the schema. We inject the venue address
// via rowDefaults so every imported Performance still resolves to the
// correct Venue record.
//
// Limitation: cast names are not surfaced by this source. If we want real
// cast for LBP shows, we'd need a Tier 2 detail-page template against
// lbplayhouse.org/event/<slug>/.

const CONFIG: ScraperDataSourceConfig = {
  startUrl: 'https://lbplayhouse.org/shows/',
  strategy: { mode: 'json-ld' },
  rowDefaults: {
    venueName: 'Long Beach Playhouse',
    venueAddress: '5021 E. Anaheim Street',
    venueCity: 'Long Beach',
    venueState: 'CA',
    venueZipCode: '90804'
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
      existing.name = 'Long Beach Playhouse (lbplayhouse.org)'
      existing.config = CONFIG as unknown as Record<string, any>
      existing.consecutiveFailures = 0
      existing.disabledReason = undefined
      existing.isActive = true
      await existing.save()
      console.log('Updated LBP DataSource:', existing._id.toString())
      return
    }

    const venue = await VenueModel.findOne({ name: { $regex: /^long beach playhouse$/i } })

    const ds = await DataSourceModel.create({
      name: 'Long Beach Playhouse (lbplayhouse.org)',
      type: 'scraper',
      url: CONFIG.startUrl,
      config: CONFIG as unknown as Record<string, any>,
      associatedVenue: venue?._id,
      createdBy: admin._id,
      isActive: true,
      consecutiveFailures: 0,
      cooldownHours: 24
    })
    console.log('Created LBP DataSource:', ds._id.toString())
  } finally {
    await mongoose.disconnect()
  }
}

main().catch(err => { console.error(err); process.exit(1) })
