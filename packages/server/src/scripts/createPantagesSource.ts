import '../config/env'
import mongoose from 'mongoose'
import { DataSourceModel } from '../entities/dataSource/dataSourceModel'
import { UserModel } from '../entities/user/userModel'
import { VenueModel } from '../entities/venue/venueModel'
import type { ScraperDataSourceConfig } from '../services/scraping/types'

// Tier 1 (JSON-LD) — Hollywood Pantages Theatre, the Broadway in Hollywood
// touring house. The cross-flag warned touring-Broadway houses often leave only
// title+poster+link on the venue page (data lives on Ticketmaster); /events/ here
// is the opposite: 7 schema.org Event nodes each carrying name, start/end (with
// times), full description, poster image, and an offers.url Ticketmaster link.
//
// includeUrlPatterns keeps only rows with a real ticket link — a couple of
// future/announce-only titles (e.g. not-yet-on-sale tours) render without an
// offers.url and would otherwise stage ticketless. Future runs pick them up as
// they go on sale.

const CONFIG: ScraperDataSourceConfig = {
  startUrl: 'https://www.broadwayinhollywood.com/events/',
  strategy: { mode: 'json-ld' },
  rowDefaults: {
    venueName: 'Hollywood Pantages Theatre',
    venueAddress: '6233 Hollywood Blvd',
    venueCity: 'Los Angeles',
    venueState: 'CA',
    venueZipCode: '90028'
  },
  // Broadway in Hollywood programs both the Pantages and the Dolby; rows for
  // other venues are filtered at review time. Keep only ticketed rows.
  includeUrlPatterns: ['http']
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
      existing.name = 'Hollywood Pantages (broadwayinhollywood.com)'
      existing.config = CONFIG as unknown as Record<string, any>
      existing.consecutiveFailures = 0
      existing.disabledReason = undefined
      existing.isActive = true
      await existing.save()
      console.log('Updated Pantages DataSource:', existing._id.toString())
      return
    }

    const venue = await VenueModel.findOne({ name: { $regex: /pantages/i } })

    const ds = await DataSourceModel.create({
      name: 'Hollywood Pantages (broadwayinhollywood.com)',
      type: 'scraper',
      url: CONFIG.startUrl,
      config: CONFIG as unknown as Record<string, any>,
      associatedVenue: venue?._id,
      createdBy: admin._id,
      isActive: true,
      consecutiveFailures: 0,
      cooldownHours: 24
    })
    console.log('Created Pantages DataSource:', ds._id.toString())
    if (venue) console.log('  associated with venue:', venue._id.toString(), `(${venue.name})`)
    else console.log('  no existing Pantages venue found — scraper will create one on first run')
  } finally {
    await mongoose.disconnect()
  }
}

main().catch(err => { console.error(err); process.exit(1) })
