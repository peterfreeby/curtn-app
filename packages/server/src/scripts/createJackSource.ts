import '../config/env'
import mongoose from 'mongoose'
import { DataSourceModel } from '../entities/dataSource/dataSourceModel'
import { UserModel } from '../entities/user/userModel'
import { VenueModel } from '../entities/venue/venueModel'
import type { ScraperDataSourceConfig } from '../services/scraping/types'

// JACK (jackny.org) — Squarespace season page + Zeffy ticketing, two-level scrape.
//
// Listing: /summer-2026-season is a hand-built season page (no Squarespace events
// collection). Each show is a `.row.sqs-row` carrying `h3.preFade` (title),
// `h4.preFade` (date, e.g. "june 16th 2026" / "JULY 17th-26th 2026"), `p.preFade`
// (synopsis), and a Zeffy TICKETS link. Layout rows without an h3 title produce no
// title and are dropped. The Zeffy URL is both the ticket link and the detail URL.
//
// Detail: the season page has NO posters, so we crawl each show's Zeffy ticket page
// for its `og:image` (a show-specific Cloudinary poster).
//
// Notes:
//  - Dates are human-formatted with ordinals; regex pulls "Month Day" and the date
//    transform infers the current year (all current shows are 2026). Range dates
//    ("JULY 17th-26th") capture the first date.
//  - Clock times aren't on the season page and are unreliable on Zeffy, so `time`
//    is left empty.
//  - Season-page URL is season-specific; update startUrl when JACK rolls a new season.

const JACK_CONFIG: ScraperDataSourceConfig = {
  startUrl: 'https://jackny.org/summer-2026-season',
  strategy: {
    mode: 'template',
    template: {
      version: 2,
      nodes: [
        {
          type: 'container',
          id: 'events',
          label: 'Events',
          selector: '.row.sqs-row',
          children: [
            {
              type: 'field',
              id: 'title',
              csvField: 'title',
              selector: 'h3.preFade',
              transform: 'trim'
            },
            {
              type: 'field',
              id: 'date',
              csvField: 'date',
              selector: 'h4.preFade',
              regex: '([A-Za-z]+\\s+\\d{1,2})',
              transform: 'date'
            },
            {
              type: 'field',
              id: 'description',
              csvField: 'showDescription',
              selector: 'p.preFade',
              transform: 'trim'
            },
            {
              type: 'field',
              id: 'ticketUrl',
              csvField: 'ticketUrl',
              selector: 'a[href*="zeffy.com"]',
              attribute: 'href',
              transform: 'trim'
            },
            {
              type: 'field',
              id: 'detailUrl',
              csvField: '_detailUrl',
              selector: 'a[href*="zeffy.com"]',
              attribute: 'href',
              transform: 'trim'
            }
          ]
        }
      ]
    }
  },
  rowDefaults: {
    venueName: 'JACK',
    venueAddress: '20 Putnam Avenue',
    venueCity: 'Brooklyn',
    venueState: 'NY',
    venueZipCode: '11216',
    performanceTypes: 'theater'
  },
  maxItems: 20,
  detail: {
    fromField: '_detailUrl',
    fingerprint: ['title'],
    template: {
      version: 2,
      nodes: [
        {
          // Zeffy ticket page carries the show poster as og:image.
          type: 'field',
          id: 'poster',
          csvField: 'showImageUrl',
          selector: 'meta[property="og:image"]',
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
      url: JACK_CONFIG.startUrl
    })
    if (existing) {
      existing.config = JACK_CONFIG
      existing.consecutiveFailures = 0
      existing.disabledReason = undefined
      existing.isActive = true
      await existing.save()
      console.log('Updated existing JACK DataSource:', existing._id.toString())
      return
    }

    const venue = await VenueModel.findOne({ name: { $regex: /^jack$/i } })

    const ds = await DataSourceModel.create({
      name: 'JACK (jackny.org)',
      type: 'scraper',
      url: JACK_CONFIG.startUrl,
      config: JACK_CONFIG,
      associatedVenue: venue?._id,
      createdBy: admin._id,
      isActive: true,
      consecutiveFailures: 0,
      cooldownHours: 24
    })
    console.log('Created JACK DataSource:', ds._id.toString())
    if (venue) console.log('  associated with venue:', venue._id.toString(), `(${venue.name})`)
    else console.log('  no existing JACK venue found — scraper will create one on first run')
  } finally {
    await mongoose.disconnect()
  }
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
