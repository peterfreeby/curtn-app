import '../config/env'
import mongoose from 'mongoose'
import { DataSourceModel } from '../entities/dataSource/dataSourceModel'
import { UserModel } from '../entities/user/userModel'
import { VenueModel } from '../entities/venue/venueModel'
import type { ScraperDataSourceConfig } from '../services/scraping/types'

// The Wild Project (thewildproject.org) — WordPress/Astra, two-level scrape.
//
// Listing: /performances/ is an Astra blog grid — one `article` per show with
// `.entry-title` (title + link to /performances/<slug>/) and `img.wp-post-image`
// (the per-show featured image / poster). Cards carry no date ("no-date-box").
//
// Detail: each show page's `og:description` reliably leads with presenter/credits
// then the date — single ("March 2, 2026 8:00pm") or range ("July 22 - August 1,
// 2026") — followed by a synopsis lead. We regex the date (and optional time) out
// of og:description and keep the whole string as the description. The on-page h1 is
// unreliable (some shows render their title as an image), so title comes from the
// listing; the page og:image is just the venue logo, so the poster comes from the
// listing featured image.
//
// Notes:
//  - Tickets route through one OvationTix calendar portal (web.ovationtix.com/trs/cal/621)
//    for every show — set as a row default.
//  - date-range transform reads the trailing shared year; single dates set start==end.

const OG_DESC = 'meta[property="og:description"]'
// "March 2, 2026" / "July 22 - August 1, 2026" — capitalized month + day, optional
// "- Month day" range tail, optional comma, trailing 4-digit year.
const DATE_RE = '([A-Z][a-z]+\\s+\\d{1,2}(?:\\s*[-–—]\\s*[A-Z][a-z]+\\s+\\d{1,2})?,?\\s*\\d{4})'

const WILD_PROJECT_CONFIG: ScraperDataSourceConfig = {
  startUrl: 'https://thewildproject.org/performances/',
  strategy: {
    mode: 'template',
    template: {
      version: 2,
      nodes: [
        {
          type: 'container',
          id: 'events',
          label: 'Events',
          selector: 'article',
          children: [
            {
              type: 'field',
              id: 'title',
              csvField: 'title',
              selector: '.entry-title',
              transform: 'trim'
            },
            {
              type: 'field',
              id: 'poster',
              csvField: 'showImageUrl',
              selector: 'img.wp-post-image',
              attribute: 'src',
              transform: 'trim'
            },
            {
              type: 'field',
              id: 'detailUrl',
              csvField: '_detailUrl',
              selector: '.entry-title a',
              attribute: 'href',
              transform: 'trim'
            }
          ]
        }
      ]
    }
  },
  rowDefaults: {
    venueName: 'The Wild Project',
    venueAddress: '195 East 3rd Street',
    venueCity: 'New York',
    venueState: 'NY',
    venueZipCode: '10009',
    performanceTypes: 'theater',
    ticketUrl: 'https://web.ovationtix.com/trs/cal/621'
  },
  maxItems: 30,
  detail: {
    fromField: '_detailUrl',
    fingerprint: ['title'],
    template: {
      version: 2,
      nodes: [
        {
          type: 'field',
          id: 'date',
          csvField: 'date',
          selector: OG_DESC,
          attribute: 'content',
          regex: DATE_RE,
          transform: 'date-range-start'
        },
        {
          type: 'field',
          id: 'runStart',
          csvField: 'runStartDate',
          selector: OG_DESC,
          attribute: 'content',
          regex: DATE_RE,
          transform: 'date-range-start'
        },
        {
          type: 'field',
          id: 'runEnd',
          csvField: 'runEndDate',
          selector: OG_DESC,
          attribute: 'content',
          regex: DATE_RE,
          transform: 'date-range-end'
        },
        {
          // NB: a `time` field reading og:description was removed — the V2 regex
          // no-match fallback returns the whole string, so shows without a clock
          // time got the entire description dumped into `time`. Wild Project times
          // are inconsistent anyway; the run-date range is the reliable temporal data.
          type: 'field',
          id: 'description',
          csvField: 'showDescription',
          selector: OG_DESC,
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
      url: WILD_PROJECT_CONFIG.startUrl
    })
    if (existing) {
      existing.config = WILD_PROJECT_CONFIG
      existing.consecutiveFailures = 0
      existing.disabledReason = undefined
      existing.isActive = true
      await existing.save()
      console.log('Updated existing Wild Project DataSource:', existing._id.toString())
      return
    }

    const venue = await VenueModel.findOne({ name: { $regex: /wild\s*project/i } })

    const ds = await DataSourceModel.create({
      name: 'The Wild Project (thewildproject.org)',
      type: 'scraper',
      url: WILD_PROJECT_CONFIG.startUrl,
      config: WILD_PROJECT_CONFIG,
      associatedVenue: venue?._id,
      createdBy: admin._id,
      isActive: true,
      consecutiveFailures: 0,
      cooldownHours: 24
    })
    console.log('Created Wild Project DataSource:', ds._id.toString())
    if (venue) console.log('  associated with venue:', venue._id.toString(), `(${venue.name})`)
    else console.log('  no existing Wild Project venue found — scraper will create one on first run')
  } finally {
    await mongoose.disconnect()
  }
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
