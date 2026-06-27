import '../config/env'
import mongoose from 'mongoose'
import { DataSourceModel } from '../entities/dataSource/dataSourceModel'
import { UserModel } from '../entities/user/userModel'
import { VenueModel } from '../entities/venue/venueModel'
import type { ScraperDataSourceConfig } from '../services/scraping/types'

// Soho Rep (sohorep.org) — WordPress, single-current-production org, two-level scrape.
//
// Listing: the homepage hero panel `.panel--hero__show` (exactly one — the current
// production) is a "link-box": the detail URL lives in its `data-target` attribute
// and the poster's alt text holds the title. We read both off the container itself
// via :scope, then crawl the show page.
//
// Detail: `/shows/<slug>/` carries a stable `.show--date` run range (e.g.
// "June 30 - July 26" — year-less, parsed against the current year by the
// date-range transform), the hero poster, a Get Tickets link, and a presenter/
// byline credits block in `.panel--hero__show--details`.
//
// Known limitation: Soho Rep does not publish a prose synopsis for its shows — the
// page is credits + extensive cast/creative *bios* with no semantic name/role
// hooks. We use the presenter/byline credits block as the description (names the
// writer, director, and producing partners) rather than forcing unstructured bios
// into the cast field. Per-performance clock times aren't on the show page (only
// the run range), so `time` is left empty.

const SOHO_REP_CONFIG: ScraperDataSourceConfig = {
  startUrl: 'https://sohorep.org/',
  strategy: {
    mode: 'template',
    template: {
      version: 2,
      nodes: [
        {
          type: 'container',
          id: 'events',
          label: 'Events',
          selector: '.panel--hero__show',
          children: [
            {
              type: 'field',
              id: 'title',
              csvField: 'title',
              selector: 'img',
              attribute: 'alt',
              transform: 'trim'
            },
            {
              // link-box pattern: detail URL is on the container's data-target attr.
              type: 'field',
              id: 'detailUrl',
              csvField: '_detailUrl',
              selector: ':scope',
              attribute: 'data-target',
              transform: 'trim'
            }
          ]
        }
      ]
    }
  },
  rowDefaults: {
    venueName: 'Soho Rep',
    venueAddress: '46 Walker Street',
    venueCity: 'New York',
    venueState: 'NY',
    venueZipCode: '10013',
    performanceTypes: 'theater'
  },
  maxItems: 10,
  detail: {
    fromField: '_detailUrl',
    fingerprint: ['title'],
    template: {
      version: 2,
      nodes: [
        {
          type: 'field',
          id: 'titleDetail',
          csvField: 'title',
          selector: 'h1',
          transform: 'trim'
        },
        {
          type: 'field',
          id: 'date',
          csvField: 'date',
          selector: '.show--date',
          transform: 'date-range-start'
        },
        {
          type: 'field',
          id: 'runStart',
          csvField: 'runStartDate',
          selector: '.show--date',
          transform: 'date-range-start'
        },
        {
          type: 'field',
          id: 'runEnd',
          csvField: 'runEndDate',
          selector: '.show--date',
          transform: 'date-range-end'
        },
        {
          type: 'field',
          id: 'ticketUrl',
          csvField: 'ticketUrl',
          selector: 'a[href*="buy-tickets"]',
          attribute: 'href',
          transform: 'trim'
        },
        {
          type: 'field',
          id: 'poster',
          csvField: 'showImageUrl',
          selector: '.panel--hero__show img',
          attribute: 'src',
          transform: 'trim'
        },
        {
          // Presenter/byline credits block (writer, director, producing partners).
          type: 'field',
          id: 'description',
          csvField: 'showDescription',
          selector: '.panel--hero__show--details',
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
      url: SOHO_REP_CONFIG.startUrl
    })
    if (existing) {
      existing.config = SOHO_REP_CONFIG
      existing.consecutiveFailures = 0
      existing.disabledReason = undefined
      existing.isActive = true
      await existing.save()
      console.log('Updated existing Soho Rep DataSource:', existing._id.toString())
      return
    }

    const venue = await VenueModel.findOne({ name: { $regex: /^soho\s*rep/i } })

    const ds = await DataSourceModel.create({
      name: 'Soho Rep (sohorep.org)',
      type: 'scraper',
      url: SOHO_REP_CONFIG.startUrl,
      config: SOHO_REP_CONFIG,
      associatedVenue: venue?._id,
      createdBy: admin._id,
      isActive: true,
      consecutiveFailures: 0,
      cooldownHours: 24
    })
    console.log('Created Soho Rep DataSource:', ds._id.toString())
    if (venue) console.log('  associated with venue:', venue._id.toString(), `(${venue.name})`)
    else console.log('  no existing Soho Rep venue found — scraper will create one on first run')
  } finally {
    await mongoose.disconnect()
  }
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
