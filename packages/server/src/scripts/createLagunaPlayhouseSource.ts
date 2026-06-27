import '../config/env'
import mongoose from 'mongoose'
import { DataSourceModel } from '../entities/dataSource/dataSourceModel'
import { UserModel } from '../entities/user/userModel'
import { VenueModel } from '../entities/venue/venueModel'
import type { ScraperDataSourceConfig } from '../services/scraping/types'

// Laguna Playhouse (lagunaplayhouse.com) — Avada/Fusion Builder, JS-rendered swiper
// of show cards on the HOME page (not /events). Single-level scrape.
//
// Each `.post-card` swiper-slide holds one show: `h2.fusion-title-heading` (title),
// `p.fusion-title-heading` (date — "JUN 10 - JUN 28, 2026" range or "July 3, 2026"
// single; trailing shared year, so the date-range transform parses both), the
// non-title `<p>` (teaser synopsis), a poster `img`, and TWO links — an info link
// to /events/<slug>/ and a dedicated purchase link
// (purchasing.lagunaplayhouse.com/EventAvailability?EventId=...). We take the
// purchase link as ticketUrl.
//
// Swiper clones the slides for its infinite loop (≈17 cards for 11 shows) — the
// title-dedup at staging collapses the duplicates. Two non-show promo cards ("New
// Season…", "…Fresh Rebrand") have no date and no ticket link; includeUrlPatterns on
// the purchasing host drops them (the filter matches ticketUrl, pre-staging).

const LAGUNA_CONFIG: ScraperDataSourceConfig = {
  startUrl: 'https://www.lagunaplayhouse.com/',
  strategy: {
    mode: 'template',
    template: {
      version: 2,
      nodes: [
        {
          type: 'container',
          id: 'events',
          label: 'Events',
          selector: '.post-card',
          children: [
            {
              type: 'field',
              id: 'title',
              csvField: 'title',
              selector: 'h2.fusion-title-heading',
              transform: 'trim'
            },
            {
              type: 'field',
              id: 'date',
              csvField: 'date',
              selector: 'p.fusion-title-heading',
              transform: 'date-range-start'
            },
            {
              type: 'field',
              id: 'runStart',
              csvField: 'runStartDate',
              selector: 'p.fusion-title-heading',
              transform: 'date-range-start'
            },
            {
              type: 'field',
              id: 'runEnd',
              csvField: 'runEndDate',
              selector: 'p.fusion-title-heading',
              transform: 'date-range-end'
            },
            {
              type: 'field',
              id: 'description',
              csvField: 'showDescription',
              selector: 'p:not(.fusion-title-heading)',
              transform: 'trim'
            },
            {
              type: 'field',
              id: 'poster',
              csvField: 'showImageUrl',
              selector: 'img',
              attribute: 'src',
              transform: 'trim'
            },
            {
              type: 'field',
              id: 'ticketUrl',
              csvField: 'ticketUrl',
              selector: 'a[href*="purchasing.lagunaplayhouse.com"]',
              attribute: 'href',
              transform: 'trim'
            }
          ]
        }
      ]
    }
  },
  // Keep only real shows (have a purchase link); drops the promo/announcement cards.
  includeUrlPatterns: ['purchasing.lagunaplayhouse.com'],
  rowDefaults: {
    venueName: 'Laguna Playhouse',
    venueAddress: '606 Laguna Canyon Road',
    venueCity: 'Laguna Beach',
    venueState: 'CA',
    venueZipCode: '92651',
    performanceTypes: 'theater'
  },
  maxItems: 40
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
      url: LAGUNA_CONFIG.startUrl
    })
    if (existing) {
      existing.config = LAGUNA_CONFIG
      existing.consecutiveFailures = 0
      existing.disabledReason = undefined
      existing.isActive = true
      await existing.save()
      console.log('Updated existing Laguna Playhouse DataSource:', existing._id.toString())
      return
    }

    const venue = await VenueModel.findOne({ name: { $regex: /laguna\s*playhouse/i } })

    const ds = await DataSourceModel.create({
      name: 'Laguna Playhouse (lagunaplayhouse.com)',
      type: 'scraper',
      url: LAGUNA_CONFIG.startUrl,
      config: LAGUNA_CONFIG,
      associatedVenue: venue?._id,
      createdBy: admin._id,
      isActive: true,
      consecutiveFailures: 0,
      cooldownHours: 24
    })
    console.log('Created Laguna Playhouse DataSource:', ds._id.toString())
    if (venue) console.log('  associated with venue:', venue._id.toString(), `(${venue.name})`)
    else console.log('  no existing Laguna Playhouse venue found — scraper will create one on first run')
  } finally {
    await mongoose.disconnect()
  }
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
