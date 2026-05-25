import '../config/env'
import mongoose from 'mongoose'
import { DataSourceModel } from '../entities/dataSource/dataSourceModel'
import { UserModel } from '../entities/user/userModel'
import { VenueModel } from '../entities/venue/venueModel'
import type { ScraperDataSourceConfig } from '../services/scraping/types'

// Tier 2 (template) — Atlantic Theater Company, Chelsea NYC.
// Container: .production ×6 on /productions/. Elementor-based page.
// Title: h2 (show name). First h4 is optional co-production tag; second h4
// is playwright/director credits (used as showDescription).
// Last p combines run dates + venue name ("April 30 – June 7, 2026\nLinda Gross
// Theater") — stored raw as runStartDate; admin splits at review.
// waitFor: '.production' — Elementor page is JS-rendered.

const CONFIG: ScraperDataSourceConfig = {
  startUrl: 'https://atlantictheater.org/productions/',
  waitFor: '.production',
  strategy: {
    mode: 'template',
    template: {
      version: 2,
      nodes: [
        {
          type: 'container',
          id: 'events',
          label: 'Events',
          selector: '.production',
          children: [
            {
              type: 'field',
              id: 'title',
              csvField: 'title',
              selector: 'h2',
              transform: 'trim'
            },
            {
              // Playwright/director credits — useful context for admin review.
              type: 'field',
              id: 'showDescription',
              csvField: 'showDescription',
              selector: 'h4:last-of-type',
              transform: 'trim'
            },
            {
              // Raw "April 30 – June 7, 2026\nLinda Gross Theater".
              // Venue name is embedded — admin corrects at review.
              type: 'field',
              id: 'runStartDate',
              csvField: 'runStartDate',
              selector: 'p:last-of-type',
              transform: 'trim'
            },
            {
              type: 'field',
              id: 'ticketUrl',
              csvField: 'ticketUrl',
              selector: 'a[href*="/production/"]',
              attribute: 'href',
              transform: 'trim'
            },
            {
              type: 'field',
              id: 'showImageUrl',
              csvField: 'showImageUrl',
              selector: 'img',
              attribute: 'src',
              transform: 'trim'
            }
          ]
        }
      ]
    }
  },
  rowDefaults: {
    venueName: 'Atlantic Theater Company',
    venueAddress: '336 W 20th St',
    venueCity: 'New York',
    venueState: 'NY',
    venueZipCode: '10011'
  },
  maxItems: 20
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
      existing.name = 'Atlantic Theater Company (atlantictheater.org)'
      existing.config = CONFIG
      existing.consecutiveFailures = 0
      existing.disabledReason = undefined
      existing.isActive = true
      await existing.save()
      console.log('Updated Atlantic Theater DataSource:', existing._id.toString())
      return
    }

    const venue = await VenueModel.findOne({ name: { $regex: /atlantic theater/i } })

    const ds = await DataSourceModel.create({
      name: 'Atlantic Theater Company (atlantictheater.org)',
      type: 'scraper',
      url: CONFIG.startUrl,
      config: CONFIG,
      associatedVenue: venue?._id,
      createdBy: admin._id,
      isActive: true,
      consecutiveFailures: 0,
      cooldownHours: 24
    })
    console.log('Created Atlantic Theater DataSource:', ds._id.toString())
    if (venue) console.log('  associated with venue:', venue._id.toString(), `(${venue.name})`)
    else console.log('  no existing Atlantic Theater venue found — scraper will create one on first run')
  } finally {
    await mongoose.disconnect()
  }
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
