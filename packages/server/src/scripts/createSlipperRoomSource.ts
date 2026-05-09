import '../config/env'
import mongoose from 'mongoose'
import { DataSourceModel } from '../entities/dataSource/dataSourceModel'
import { UserModel } from '../entities/user/userModel'
import { VenueModel } from '../entities/venue/venueModel'
import type { ScraperDataSourceConfig } from '../services/scraping/types'

// Slipper Room — slipperroom.com/shows. The /calendar URL is a Wix calendar
// widget that truncates to "+1 more" per day; /shows is the Wix Events list
// view, much friendlier. Uses Wix's data-hook attributes for stable selectors
// (Wix's own testing convention — they don't regenerate on save like the
// CSS-in-JS class hashes do).

const CONFIG: ScraperDataSourceConfig = {
  startUrl: 'https://www.slipperroom.com/shows',
  strategy: {
    mode: 'template',
    template: {
      version: 2,
      nodes: [
        {
          type: 'container',
          id: 'events',
          label: 'Events',
          selector: '[data-hook="side-by-side-item"]',
          children: [
            {
              type: 'field',
              id: 'title',
              csvField: 'title',
              selector: '[data-hook="title"]',
              transform: 'trim'
            },
            {
              // Wix renders date as "May 08, 2026, 8:00 PM" (single) or
              // "May 08, 2026, 11:50 PM – May 09, 2026, 3:00" (multi-day).
              // Capture the first month/day/year token; the date transform
              // handles "May 08, 2026" cleanly.
              type: 'field',
              id: 'date',
              csvField: 'date',
              selector: '[data-hook="date"]',
              regex: '^([A-Za-z]+\\s+\\d+,\\s*\\d{4})',
              transform: 'date'
            },
            {
              // Pull the time portion out of the same string ("8:00 PM").
              type: 'field',
              id: 'time',
              csvField: 'time',
              selector: '[data-hook="date"]',
              regex: '(\\d{1,2}:\\d{2}\\s*(?:AM|PM))',
              transform: 'time'
            },
            {
              type: 'field',
              id: 'ticketUrl',
              csvField: 'ticketUrl',
              selector: '[data-hook="title"]',
              attribute: 'href',
              transform: 'trim'
            },
            {
              // First [data-hook="image"] holds the bigger fit-display image;
              // pick its inner img src. Wix renders multiple <img>s for
              // different formats — first is the highest-quality variant.
              type: 'field',
              id: 'image',
              csvField: 'showImageUrl',
              selector: '[data-hook="image"] img',
              attribute: 'src',
              transform: 'trim'
            },
            {
              // Capture detail page URL for future enrichment (descriptions
              // live on the per-event detail page on Wix sites). Stripped
              // before staging.
              type: 'field',
              id: 'detailUrl',
              csvField: '_detailUrl',
              selector: '[data-hook="title"]',
              attribute: 'href',
              transform: 'trim'
            }
          ]
        }
      ]
    }
  },
  rowDefaults: {
    venueName: 'The Slipper Room',
    venueAddress: '167 Orchard St',
    venueCity: 'New York',
    venueState: 'NY',
    venueZipCode: '10002',
    performanceTypes: 'burlesque'
  },
  maxItems: 50
}

async function main() {
  const mongoUrl = process.env.MONGODB_URL
  if (!mongoUrl) throw new Error('MONGODB_URL not set')
  await mongoose.connect(mongoUrl)

  try {
    const admin = await UserModel.findOne({ isAdmin: true })
    if (!admin) throw new Error('No admin user found')

    const existing = await DataSourceModel.findOne({
      type: 'scraper',
      url: CONFIG.startUrl
    })
    if (existing) {
      existing.config = CONFIG
      existing.consecutiveFailures = 0
      existing.disabledReason = undefined
      existing.isActive = true
      await existing.save()
      console.log('Updated existing Slipper Room DataSource:', existing._id.toString())
      return
    }

    const venue = await VenueModel.findOne({
      name: { $regex: /slipper room/i }
    })

    const ds = await DataSourceModel.create({
      name: 'Slipper Room (slipperroom.com)',
      type: 'scraper',
      url: CONFIG.startUrl,
      config: CONFIG,
      associatedVenue: venue?._id,
      createdBy: admin._id,
      isActive: true,
      consecutiveFailures: 0,
      cooldownHours: 24
    })
    console.log('Created Slipper Room DataSource:', ds._id.toString())
    if (venue) console.log('  associated with venue:', venue._id.toString(), `(${venue.name})`)
    else console.log('  no existing Slipper Room venue found — scraper will create one on first run')
  } finally {
    await mongoose.disconnect()
  }
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
