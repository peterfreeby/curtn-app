import '../config/env'
import mongoose from 'mongoose'
import { DataSourceModel } from '../entities/dataSource/dataSourceModel'
import { UserModel } from '../entities/user/userModel'
import { VenueModel } from '../entities/venue/venueModel'
import type { ScraperDataSourceConfig } from '../services/scraping/types'

// Theater for the New City (theaterforthenewcity.net) — WordPress, two-level scrape.
//
// Listing: /whats-playing/ renders one `.showcard` per current/upcoming show with
// everything inline — `.title`, `.show-img` (poster), `.dates` (run range, e.g.
// "May 28 – June 7"; year-less, current year inferred by the date-range transform),
// `.writer` credits, and an `.img-link` → /shows/<slug>/.
//
// Detail: the show page's og:description carries the fuller synopsis (the listing
// card has no synopsis, only credits), so we crawl it just for the description.
//
// Notes:
//  - Tickets route through one OvationTix portal (ci.ovationtix.com/35441) — row default.
//  - Per-performance times vary by day (e.g. "Thu/Fri/Sat 8PM, Sun 3PM") so `time`
//    is left empty; the run-date range captures the span.

const TNC_CONFIG: ScraperDataSourceConfig = {
  startUrl: 'https://theaterforthenewcity.net/whats-playing/',
  strategy: {
    mode: 'template',
    template: {
      version: 2,
      nodes: [
        {
          type: 'container',
          id: 'events',
          label: 'Events',
          selector: '.showcard',
          children: [
            {
              type: 'field',
              id: 'title',
              csvField: 'title',
              selector: '.title',
              transform: 'trim'
            },
            {
              type: 'field',
              id: 'poster',
              csvField: 'showImageUrl',
              selector: '.show-img',
              attribute: 'src',
              transform: 'trim'
            },
            {
              type: 'field',
              id: 'date',
              csvField: 'date',
              selector: '.dates',
              transform: 'date-range-start'
            },
            {
              type: 'field',
              id: 'runStart',
              csvField: 'runStartDate',
              selector: '.dates',
              transform: 'date-range-start'
            },
            {
              type: 'field',
              id: 'runEnd',
              csvField: 'runEndDate',
              selector: '.dates',
              transform: 'date-range-end'
            },
            {
              type: 'field',
              id: 'detailUrl',
              csvField: '_detailUrl',
              selector: '.img-link',
              attribute: 'href',
              transform: 'trim'
            }
          ]
        }
      ]
    }
  },
  rowDefaults: {
    venueName: 'Theater for the New City',
    venueAddress: '155 First Avenue',
    venueCity: 'New York',
    venueState: 'NY',
    venueZipCode: '10003',
    performanceTypes: 'theater',
    ticketUrl: 'https://ci.ovationtix.com/35441'
  },
  maxItems: 25,
  detail: {
    fromField: '_detailUrl',
    fingerprint: ['title'],
    template: {
      version: 2,
      nodes: [
        {
          type: 'field',
          id: 'description',
          csvField: 'showDescription',
          selector: 'meta[property="og:description"]',
          attribute: 'content',
          transform: 'trim'
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
    if (!admin) throw new Error('No admin user found — run setAdmin first')

    const existing = await DataSourceModel.findOne({
      type: 'scraper',
      url: TNC_CONFIG.startUrl
    })
    if (existing) {
      existing.config = TNC_CONFIG
      existing.consecutiveFailures = 0
      existing.disabledReason = undefined
      existing.isActive = true
      await existing.save()
      console.log('Updated existing TNC DataSource:', existing._id.toString())
      return
    }

    const venue = await VenueModel.findOne({ name: { $regex: /theater\s*for\s*the\s*new\s*city/i } })

    const ds = await DataSourceModel.create({
      name: 'Theater for the New City (theaterforthenewcity.net)',
      type: 'scraper',
      url: TNC_CONFIG.startUrl,
      config: TNC_CONFIG,
      associatedVenue: venue?._id,
      createdBy: admin._id,
      isActive: true,
      consecutiveFailures: 0,
      cooldownHours: 24
    })
    console.log('Created TNC DataSource:', ds._id.toString())
    if (venue) console.log('  associated with venue:', venue._id.toString(), `(${venue.name})`)
    else console.log('  no existing TNC venue found — scraper will create one on first run')
  } finally {
    await mongoose.disconnect()
  }
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
