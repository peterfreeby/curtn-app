import '../config/env'
import mongoose from 'mongoose'
import { DataSourceModel } from '../entities/dataSource/dataSourceModel'
import { UserModel } from '../entities/user/userModel'
import { VenueModel } from '../entities/venue/venueModel'
import type { ScraperDataSourceConfig } from '../services/scraping/types'

// Tier 2 (template) — Playwrights Horizons, Theatre Row NYC.
// Container: .page-item ×7. Title in h3.page-item__title, description in
// p.page-item__summary. No dates on listing page. Detail URL is relative
// (e.g. /shows/production-history/2025-26/...) — engine resolves against startUrl.
// waitFor: '.page-item' — page is JS-rendered; wait for first card to appear.

const CONFIG: ScraperDataSourceConfig = {
  startUrl: 'https://www.playwrightshorizons.org/shows/',
  waitFor: '.page-item',
  strategy: {
    mode: 'template',
    template: {
      version: 2,
      nodes: [
        {
          type: 'container',
          id: 'events',
          label: 'Events',
          selector: '.page-item',
          children: [
            {
              type: 'field',
              id: 'title',
              csvField: 'title',
              selector: 'h3.page-item__title',
              transform: 'trim'
            },
            {
              type: 'field',
              id: 'showDescription',
              csvField: 'showDescription',
              selector: 'p.page-item__summary',
              transform: 'trim'
            },
            {
              type: 'field',
              id: 'ticketUrl',
              csvField: 'ticketUrl',
              selector: 'a.page-item__link',
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
    venueName: 'Playwrights Horizons',
    venueAddress: '416 W 42nd St',
    venueCity: 'New York',
    venueState: 'NY',
    venueZipCode: '10036'
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
      existing.name = 'Playwrights Horizons (playwrightshorizons.org)'
      existing.config = CONFIG
      existing.consecutiveFailures = 0
      existing.disabledReason = undefined
      existing.isActive = true
      await existing.save()
      console.log('Updated Playwrights Horizons DataSource:', existing._id.toString())
      return
    }

    const venue = await VenueModel.findOne({ name: { $regex: /playwrights horizons/i } })

    const ds = await DataSourceModel.create({
      name: 'Playwrights Horizons (playwrightshorizons.org)',
      type: 'scraper',
      url: CONFIG.startUrl,
      config: CONFIG,
      associatedVenue: venue?._id,
      createdBy: admin._id,
      isActive: true,
      consecutiveFailures: 0,
      cooldownHours: 24
    })
    console.log('Created Playwrights Horizons DataSource:', ds._id.toString())
    if (venue) console.log('  associated with venue:', venue._id.toString(), `(${venue.name})`)
    else console.log('  no existing Playwrights Horizons venue found — scraper will create one on first run')
  } finally {
    await mongoose.disconnect()
  }
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
