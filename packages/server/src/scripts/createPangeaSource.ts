import '../config/env'
import mongoose from 'mongoose'
import { DataSourceModel } from '../entities/dataSource/dataSourceModel'
import { UserModel } from '../entities/user/userModel'
import { VenueModel } from '../entities/venue/venueModel'
import type { ScraperDataSourceConfig } from '../services/scraping/types'

// Tier 1 (JSON-LD) — Pangea, East Village cabaret venue.
// probeSeedList found 40 Events on /music/. The /music/ path is where Pangea
// posts upcoming shows; the root page redirects there. rowDefaults inject the
// physical address because Pangea's JSON-LD typically omits the venue schema.

export const CONFIG: ScraperDataSourceConfig = {
  startUrl: 'https://pangeanyc.com/music/',
  strategy: { mode: 'json-ld' },
  // Detail posters resolve to insecure http:// URLs on pangeanyc.com, which the
  // https admin UI blocks as mixed content (renders as a missing image). Rehost
  // each poster to R2 so it serves over https.
  rehostImages: true,
  rowDefaults: {
    venueName: 'Pangea',
    venueAddress: '178 2nd Ave',
    venueCity: 'New York',
    venueState: 'NY',
    venueZipCode: '10003',
    performanceTypes: 'cabaret'
  },
  // Titles carry a trailing showtime ("Show Name, 7:00pm–8:30pm, no cover");
  // descriptions lead/trail with reservation + venue boilerplate.
  cleanup: {
    titleStripPatterns: [
      ',\\s*\\d{1,2}:\\d{2}\\s*[ap]m(\\s*[-\\u2013]\\s*\\d{1,2}:\\d{2}\\s*[ap]m)?(\\s*,\\s*no cover)?\\s*$'
    ],
    descriptionStripPatterns: [
      '^\\s*BUY TICKETS\\s*',
      'To make a reservation call:[\\s\\S]*?\\(click here\\)\\s*',
      'VENUE DETAILS[\\s\\S]*$',
      '\\s*Click here for more information\\.?\\s*$'
    ]
  },
  // JSON-LD omits the poster; pull it from the detail page (the full-size show
  // image, not the header logo).
  detail: {
    fromField: '_detailUrl',
    fingerprint: ['title'],
    template: {
      version: 2,
      nodes: [
        {
          type: 'container',
          id: 'detail',
          label: 'Show poster',
          selector: 'body',
          children: [
            { type: 'field', id: 'poster', csvField: 'showImageUrl', selector: 'img.size-full', attribute: 'src', transform: 'trim' }
          ]
        }
      ]
    }
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
      existing.name = 'Pangea (pangeanyc.com)'
      existing.config = CONFIG as unknown as Record<string, any>
      existing.consecutiveFailures = 0
      existing.disabledReason = undefined
      existing.isActive = true
      await existing.save()
      console.log('Updated Pangea DataSource:', existing._id.toString())
      return
    }

    const venue = await VenueModel.findOne({ name: { $regex: /^pangea$/i } })

    const ds = await DataSourceModel.create({
      name: 'Pangea (pangeanyc.com)',
      type: 'scraper',
      url: CONFIG.startUrl,
      config: CONFIG as unknown as Record<string, any>,
      associatedVenue: venue?._id,
      createdBy: admin._id,
      isActive: true,
      consecutiveFailures: 0,
      cooldownHours: 24
    })
    console.log('Created Pangea DataSource:', ds._id.toString())
  } finally {
    await mongoose.disconnect()
  }
}

if (require.main === module) main().catch(err => { console.error(err); process.exit(1) })
