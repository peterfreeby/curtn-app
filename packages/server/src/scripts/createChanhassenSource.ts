import '../config/env'
import mongoose from 'mongoose'
import { DataSourceModel } from '../entities/dataSource/dataSourceModel'
import { UserModel } from '../entities/user/userModel'
import { VenueModel } from '../entities/venue/venueModel'
import type { ScraperDataSourceConfig } from '../services/scraping/types'

// Chanhassen Dinner Theatres (chanhassendt.com) — the largest professional
// dinner theater in the US; year-round musicals/comedy/concerts across four
// stages. JS-rendered (no static markup, no JSON-LD), but Playwright hydrates a
// clean `.spl-card` grid: `.spl-card-title`, the first `.spl-card-tag` is the
// genre (Musical/Comedy/Concert), `.spl-card-desc` is a full blurb,
// `.spl-card-img` the poster, `.spl-btn-solid` the Buy-Tickets link, and
// `.spl-btn-arrow` the Learn-More link to the show's own /<slug>/ page.
//
// The run-date range lives on the detail page as an unclassed <p>
// ("February 13, 2026 – September 26, 2026"), so detail-fetch grabs the whole
// page text and regexes the range out, taking the opening date; og:image there
// overrides the listing thumbnail. (A couple of cards point Learn-More at a
// series landing page rather than a single show; those may not yield a date and
// drop at review.)

const RANGE_RX = '([A-Z][a-z]+\\s+\\d{1,2},\\s*\\d{4}\\s*[\\u2013\\u2014-]\\s*[A-Z][a-z]+\\s+\\d{1,2},\\s*\\d{4})'

const CONFIG: ScraperDataSourceConfig = {
  startUrl: 'https://chanhassendt.com/',
  strategy: {
    mode: 'template',
    template: {
      version: 2,
      nodes: [
        {
          type: 'container',
          id: 'events',
          label: 'Events',
          selector: '.spl-card',
          children: [
            { type: 'field', id: 'title', csvField: 'title', selector: '.spl-card-title', transform: 'trim' },
            { type: 'field', id: 'genre', csvField: 'performanceTypes', selector: '.spl-card-tag', transform: 'trim' },
            { type: 'field', id: 'desc', csvField: 'showDescription', selector: '.spl-card-desc', transform: 'trim' },
            { type: 'field', id: 'poster', csvField: 'showImageUrl', selector: '.spl-card-img', attribute: 'src', transform: 'trim' },
            // Use the show's own page (Learn More) as the ticket/info URL: it
            // carries the Buy-Tickets button and, unlike the raw ticketing link,
            // its slug lets us filter out the open-run series below.
            { type: 'field', id: 'ticketUrl', csvField: 'ticketUrl', selector: '.spl-btn-arrow', attribute: 'href', transform: 'trim' },
            { type: 'field', id: 'detailUrl', csvField: '_detailUrl', selector: '.spl-btn-arrow', attribute: 'href', transform: 'trim' }
          ]
        }
      ]
    }
  },
  // Drop Chanhassen's permanent open-run programs (Concert Series, Stevie Ray's
  // Comedy Cabaret, Drag Brunch, The Groove) — they have no discrete run dates
  // (the "open-run, no fixed dates" problem, pending a data-model decision), so
  // they'd otherwise stage with a placeholder date. Their slugs are stable
  // recurring programs; new fixed-run mainstage productions pass through.
  excludeUrlPatterns: ['/on-stage/concerts', '/on-stage/comedy', '/dragshows', '/the-groove'],
  rowDefaults: {
    venueName: 'Chanhassen Dinner Theatres',
    venueAddress: '501 W 78th St',
    venueCity: 'Chanhassen',
    venueState: 'MN',
    venueZipCode: '55317'
  },
  maxItems: 40,
  detail: {
    fromField: '_detailUrl',
    fingerprint: ['title'],
    template: {
      version: 2,
      nodes: [
        {
          type: 'container',
          id: 'detail',
          label: 'Event detail',
          selector: 'html',
          children: [
            {
              // Run-date range from page text; range-start = opening date.
              type: 'field',
              id: 'date',
              csvField: 'date',
              selector: 'body',
              regex: RANGE_RX,
              transform: 'date-range-start'
            },
            {
              type: 'field',
              id: 'runStart',
              csvField: 'runStartDate',
              selector: 'body',
              regex: RANGE_RX,
              transform: 'date-range-start'
            },
            {
              type: 'field',
              id: 'runEnd',
              csvField: 'runEndDate',
              selector: 'body',
              regex: RANGE_RX,
              transform: 'date-range-end'
            },
            {
              type: 'field',
              id: 'poster',
              csvField: 'showImageUrl',
              selector: 'meta[property="og:image"], meta[name="og:image"]',
              attribute: 'content',
              transform: 'trim'
            }
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
    if (!admin) throw new Error('No admin user found — run setAdmin first')

    const existing = await DataSourceModel.findOne({ type: 'scraper', url: CONFIG.startUrl })
    if (existing) {
      existing.config = CONFIG
      existing.consecutiveFailures = 0
      existing.disabledReason = undefined
      existing.isActive = true
      await existing.save()
      console.log('Updated existing Chanhassen DataSource:', existing._id.toString())
      return
    }

    const venue = await VenueModel.findOne({ name: { $regex: /chanhassen/i } })

    const ds = await DataSourceModel.create({
      name: 'Chanhassen Dinner Theatres (chanhassendt.com)',
      type: 'scraper',
      purpose: 'scraper',
      url: CONFIG.startUrl,
      config: CONFIG,
      associatedVenue: venue?._id,
      createdBy: admin._id,
      isActive: true,
      consecutiveFailures: 0,
      cooldownHours: 24
    })
    console.log('Created Chanhassen DataSource:', ds._id.toString())
    if (venue) console.log('  associated with venue:', venue._id.toString(), `(${venue.name})`)
  } finally {
    await mongoose.disconnect()
  }
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
