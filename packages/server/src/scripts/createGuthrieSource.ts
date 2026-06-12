import '../config/env'
import mongoose from 'mongoose'
import { DataSourceModel } from '../entities/dataSource/dataSourceModel'
import { UserModel } from '../entities/user/userModel'
import { VenueModel } from '../entities/venue/venueModel'
import type { ScraperDataSourceConfig } from '../services/scraping/types'

// Guthrie Theater (guthrietheater.org) — Tier 2, LISTING-ONLY.
//
// The /whats-on/ listing renders rich production cards (.c-event-card--production)
// with title, year-bearing run range, poster (Substrakt CDN), and the specific
// STAGE (Wurtele Thrust / McGuire Proscenium / Dowling Studio) — so one source
// captures multi-stage granularity per row.
//
// Description: NOT extractable. The detail page HAS a clean `og:description`
// meta tag, but every channel to it fails:
//   - FB OG fallback (rung 4): FB's scrape=true REJECTS the page — its og:image
//     is empty and FB requires og:image:url, so it 400s instead of returning
//     the description.
//   - DOM detail-fetch of the meta tag: works on a single polite fetch, but the
//     scraper's rapid listing+details sequence trips Guthrie's Cloudflare
//     escalation — detail pages come back as "Attention Required" challenge
//     pages (verified 2026-06-02), so the meta isn't there.
//   - BODY synopsis: undifferentiated Substrakt "Construkt" blocks, hydration-
//     variable count — no robust selector.
// Conclusion: LISTING-ONLY. Descriptions need manual entry for these few shows.

const CONFIG: ScraperDataSourceConfig = {
  startUrl: 'https://www.guthrietheater.org/whats-on/',
  strategy: {
    mode: 'template',
    template: {
      version: 2,
      nodes: [
        {
          type: 'container',
          id: 'productions',
          label: 'Productions',
          selector: '.c-event-card--production',
          children: [
            { type: 'field', id: 'title', csvField: 'title', selector: '.c-event-card__title', transform: 'trim' },
            {
              type: 'field',
              id: 'runStartDate',
              csvField: 'runStartDate',
              selector: '.c-event-card__time',
              transform: 'date-range-start'
            },
            {
              type: 'field',
              id: 'runEndDate',
              csvField: 'runEndDate',
              selector: '.c-event-card__time',
              transform: 'date-range-end'
            },
            {
              type: 'field',
              id: 'poster',
              csvField: 'showImageUrl',
              selector: '.c-event-card__image img',
              attribute: 'src',
              transform: 'trim'
            },
            // The specific stage within the Guthrie (multi-stage venue).
            { type: 'field', id: 'stage', csvField: 'stageName', selector: '.c-event-card__venue', transform: 'trim' },
            {
              type: 'field',
              id: 'ticketUrl',
              csvField: 'ticketUrl',
              selector: '.c-event-card__cover-link',
              attribute: 'href',
              transform: 'trim'
            }
          ]
        }
      ]
    }
  },
  rowDefaults: {
    venueName: 'Guthrie Theater',
    venueAddress: '818 South 2nd Street',
    venueCity: 'Minneapolis',
    venueState: 'MN',
    venueZipCode: '55415',
    performanceTypes: 'theater'
  },
  maxItems: 30
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
      console.log('Updated existing Guthrie DataSource:', existing._id.toString())
      return
    }

    const venue = await VenueModel.findOne({ name: { $regex: /^guthrie theater$/i } })
    const ds = await DataSourceModel.create({
      name: 'Guthrie Theater (guthrietheater.org)',
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
    console.log('Created Guthrie DataSource:', ds._id.toString())
  } finally {
    await mongoose.disconnect()
  }
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
