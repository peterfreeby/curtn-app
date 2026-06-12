import '../config/env'
import mongoose from 'mongoose'
import { DataSourceModel } from '../entities/dataSource/dataSourceModel'
import { UserModel } from '../entities/user/userModel'
import { VenueModel } from '../entities/venue/venueModel'
import type { ScraperDataSourceConfig } from '../services/scraping/types'

// Tier 2 (template) — Flushing Town Hall, Queens.
// Listing: /fth-presents = FTH's own programmed (ticketed) shows. Container
// .show-item ×12. /events also exists but mixes in off-site community-grantee
// events that carry no time/ticket (free, prose-only) and miss the quality bar,
// so we scrape the clean presented subset.
// Listing gives title, run dates (.sale-date / .end-date), poster (.show-image img,
// a real listing_image .webp), partial description, and the detail-page link.
// Detail pages (no JSON-LD) carry the showtime in the banner ("Jun 10, 2026 - 7:00 PM"),
// an OvationTix BUY TICKETS button (a[href*="/production/"]), and the full
// description in the #about tab — fetched via detail-following.

const CONFIG: ScraperDataSourceConfig = {
  startUrl: 'https://www.flushingtownhall.org/fth-presents',
  strategy: {
    mode: 'template',
    template: {
      version: 2,
      nodes: [
        {
          type: 'container',
          id: 'events',
          label: 'Events',
          selector: '.show-item',
          children: [
            {
              type: 'field',
              id: 'title',
              csvField: 'title',
              selector: '.show-title',
              transform: 'trim'
            },
            {
              type: 'field',
              id: 'date',
              csvField: 'date',
              selector: '.sale-date',
              transform: 'date'
            },
            {
              type: 'field',
              id: 'runStartDate',
              csvField: 'runStartDate',
              selector: '.sale-date',
              transform: 'date'
            },
            {
              type: 'field',
              id: 'runEndDate',
              csvField: 'runEndDate',
              selector: '.end-date',
              transform: 'date'
            },
            {
              type: 'field',
              id: 'showDescription',
              csvField: 'showDescription',
              selector: '.show-description',
              transform: 'trim'
            },
            {
              type: 'field',
              id: 'showImageUrl',
              csvField: 'showImageUrl',
              selector: '.show-image img',
              attribute: 'src',
              transform: 'trim'
            },
            {
              type: 'field',
              id: 'detailUrl',
              csvField: '_detailUrl',
              selector: '.show-image a',
              attribute: 'href',
              transform: 'trim'
            }
          ]
        }
      ]
    }
  },
  detail: {
    fromField: '_detailUrl',
    fingerprint: ['title'],
    template: {
      version: 2,
      nodes: [
        {
          type: 'container',
          id: 'detail',
          label: 'Show detail',
          // The page has two duplicate id="wrapper" divs (invalid HTML) which
          // fan out 2x per event, so anchor on the unique <body> instead. It
          // contains the banner (.bg-heading) and the content column
          // (BUY TICKETS button + #about tab).
          selector: 'body',
          children: [
            {
              // Banner reads "Jun 10, 2026 - 7:00 PM" when ticketed; festivals/
              // storytelling events show only the date. The optional capture
              // returns the time when the "<date> - <time>" form is present and
              // an empty string otherwise (no-match would otherwise fall back to
              // the raw date text, which the 'time' transform can't reject).
              type: 'field',
              id: 'time',
              csvField: 'time',
              selector: '.bg-heading p',
              regex: '^(?:.*?-\\s*(\\d{1,2}:\\d{2}\\s*[AP]M))?',
              transform: 'time'
            },
            {
              // OvationTix "BUY TICKETS" button; account/store links lack /production/.
              type: 'field',
              id: 'ticketUrl',
              csvField: 'ticketUrl',
              selector: 'a[href*="/production/"]',
              attribute: 'href',
              transform: 'trim'
            },
            {
              // Full description — overrides the truncated listing blurb.
              type: 'field',
              id: 'fullDescription',
              csvField: 'showDescription',
              selector: '#about',
              transform: 'trim'
            }
          ]
        }
      ]
    }
  },
  rowDefaults: {
    venueName: 'Flushing Town Hall',
    venueAddress: '137-35 Northern Blvd',
    venueCity: 'Queens',
    venueState: 'NY',
    venueZipCode: '11354'
  },
  maxItems: 30
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
      existing.name = 'Flushing Town Hall (flushingtownhall.org)'
      existing.config = CONFIG
      existing.consecutiveFailures = 0
      existing.disabledReason = undefined
      existing.isActive = true
      await existing.save()
      console.log('Updated Flushing Town Hall DataSource:', existing._id.toString())
      return
    }

    const venue = await VenueModel.findOne({ name: { $regex: /flushing town hall/i } })

    const ds = await DataSourceModel.create({
      name: 'Flushing Town Hall (flushingtownhall.org)',
      type: 'scraper',
      url: CONFIG.startUrl,
      config: CONFIG,
      associatedVenue: venue?._id,
      createdBy: admin._id,
      isActive: true,
      consecutiveFailures: 0,
      cooldownHours: 24
    })
    console.log('Created Flushing Town Hall DataSource:', ds._id.toString())
    if (venue) console.log('  associated with venue:', venue._id.toString(), `(${venue.name})`)
    else console.log('  no existing Flushing Town Hall venue found — scraper will create one on first run')
  } finally {
    await mongoose.disconnect()
  }
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
