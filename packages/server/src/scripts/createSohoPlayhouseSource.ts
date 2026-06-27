import '../config/env'
import mongoose from 'mongoose'
import { DataSourceModel } from '../entities/dataSource/dataSourceModel'
import { UserModel } from '../entities/user/userModel'
import { VenueModel } from '../entities/venue/venueModel'
import type { ScraperDataSourceConfig } from '../services/scraping/types'

// SoHo Playhouse (sohoplayhouse.com) — Squarespace portfolio grid, single-level scrape.
//
// Listing: /see-a-show is a Squarespace portfolio grid of `.grid-item`s. Each show
// link's text mashes title + run range ("HARDLOVE | May 1 - June 6"), with a real
// poster img alongside. We split the title (before "|") and the date range (after
// "|", " - "-separated so parseDateRange handles it) out of that text.
//
// Notes:
//  - Detail crawl for the synopsis: each show page is a stack of Squarespace
//    html blocks where block[0] is the title and block[1] is the synopsis
//    (block[2+] are logistics — run time, age, box office). We grab the synopsis
//    via `.sqs-html-content` index:1 and skip the logistics blocks. (There is no
//    og:description on these pages, which is why the first pass shipped without a
//    description — the synopsis lives in the second html block, not in meta.)
//  - Tickets route through one OvationTix portal (ci.ovationtix.com/35583) — row default.
//  - Year-less dates → current year inferred by date-range transform (no roll-forward,
//    so mid-run shows that started in the recent past keep the correct year).

const RANGE_RE = '\\|\\s*(.+)$'

const SOHO_PLAYHOUSE_CONFIG: ScraperDataSourceConfig = {
  startUrl: 'https://sohoplayhouse.com/see-a-show',
  strategy: {
    mode: 'template',
    template: {
      version: 2,
      nodes: [
        {
          type: 'container',
          id: 'events',
          label: 'Events',
          // Each .grid-item IS the <a class="grid-item" href="/see-a-show/<slug>">;
          // the "TITLE | dates" string lives in the .portfolio-title h3 inside it.
          selector: '.grid-item',
          children: [
            {
              type: 'field',
              id: 'title',
              csvField: 'title',
              selector: '.portfolio-title',
              regex: '^(.+?)\\s*\\|',
              transform: 'trim'
            },
            {
              type: 'field',
              id: 'date',
              csvField: 'date',
              selector: '.portfolio-title',
              regex: RANGE_RE,
              transform: 'date-range-start'
            },
            {
              type: 'field',
              id: 'runStart',
              csvField: 'runStartDate',
              selector: '.portfolio-title',
              regex: RANGE_RE,
              transform: 'date-range-start'
            },
            {
              type: 'field',
              id: 'runEnd',
              csvField: 'runEndDate',
              selector: '.portfolio-title',
              regex: RANGE_RE,
              transform: 'date-range-end'
            },
            {
              // Lazy-loaded: src is absent, extractField falls back to data-src.
              type: 'field',
              id: 'poster',
              csvField: 'showImageUrl',
              selector: 'img',
              attribute: 'src',
              transform: 'trim'
            },
            {
              // .grid-item IS the <a> to the show page — capture it for the
              // synopsis detail-fetch.
              type: 'field',
              id: 'detailUrl',
              csvField: '_detailUrl',
              selector: ':scope',
              attribute: 'href',
              transform: 'trim'
            }
          ]
        }
      ]
    }
  },
  rowDefaults: {
    venueName: 'SoHo Playhouse',
    venueAddress: '15 Vandam Street',
    venueCity: 'New York',
    venueState: 'NY',
    venueZipCode: '10013',
    performanceTypes: 'theater',
    ticketUrl: 'https://ci.ovationtix.com/35583'
  },
  maxItems: 30,
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
          selector: 'body',
          children: [
            {
              // Squarespace html blocks: [0]=title, [1]=synopsis, [2+]=logistics.
              // index:1 grabs the synopsis and skips run-time/box-office text.
              type: 'field',
              id: 'synopsis',
              csvField: 'showDescription',
              selector: '.sqs-html-content',
              index: 1,
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

    const existing = await DataSourceModel.findOne({
      type: 'scraper',
      url: SOHO_PLAYHOUSE_CONFIG.startUrl
    })
    if (existing) {
      existing.config = SOHO_PLAYHOUSE_CONFIG
      existing.consecutiveFailures = 0
      existing.disabledReason = undefined
      existing.isActive = true
      await existing.save()
      console.log('Updated existing SoHo Playhouse DataSource:', existing._id.toString())
      return
    }

    const venue = await VenueModel.findOne({ name: { $regex: /soho\s*playhouse/i } })

    const ds = await DataSourceModel.create({
      name: 'SoHo Playhouse (sohoplayhouse.com)',
      type: 'scraper',
      url: SOHO_PLAYHOUSE_CONFIG.startUrl,
      config: SOHO_PLAYHOUSE_CONFIG,
      associatedVenue: venue?._id,
      createdBy: admin._id,
      isActive: true,
      consecutiveFailures: 0,
      cooldownHours: 24
    })
    console.log('Created SoHo Playhouse DataSource:', ds._id.toString())
    if (venue) console.log('  associated with venue:', venue._id.toString(), `(${venue.name})`)
    else console.log('  no existing SoHo Playhouse venue found — scraper will create one on first run')
  } finally {
    await mongoose.disconnect()
  }
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
