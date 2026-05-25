import '../config/env'
import mongoose from 'mongoose'
import { DataSourceModel } from '../entities/dataSource/dataSourceModel'
import { UserModel } from '../entities/user/userModel'
import { VenueModel } from '../entities/venue/venueModel'
import type { ScraperDataSourceConfig } from '../services/scraping/types'

// Tier 2 (template) — Roundabout Theatre Company, multiple NYC venues.
// Scrapes /get-tickets/seasons — container is .scroller__link (the <a> tag itself).
// Title in h3.visually-hidden, poster in img.scroller__media.
// Ticket/detail URL extracted via ':scope' (the container element's own href).
// waitFor: '.scroller__link' — JS-rendered carousel; wait for cards.
//
// Note: Roundabout operates multiple spaces (American Airlines, Studio 54,
// Todd Haimes, Laura Pels). rowDefaults left sparse — venue varies per show.
// Admin assigns correct venue at review.

const CONFIG: ScraperDataSourceConfig = {
  startUrl: 'https://www.roundabouttheatre.org/get-tickets/seasons/',
  waitFor: '.scroller__link',
  strategy: {
    mode: 'template',
    template: {
      version: 2,
      nodes: [
        {
          type: 'container',
          id: 'events',
          label: 'Events',
          selector: '.scroller__link',
          children: [
            {
              type: 'field',
              id: 'title',
              csvField: 'title',
              selector: 'h3.visually-hidden',
              transform: 'trim'
            },
            {
              // Container is the <a> itself — ':scope' reads its own href.
              type: 'field',
              id: 'ticketUrl',
              csvField: 'ticketUrl',
              selector: ':scope',
              attribute: 'href',
              transform: 'trim'
            },
            {
              type: 'field',
              id: 'showImageUrl',
              csvField: 'showImageUrl',
              selector: 'img.scroller__media',
              attribute: 'src',
              transform: 'trim'
            }
          ]
        }
      ]
    }
  },
  rowDefaults: {
    venueCity: 'New York',
    venueState: 'NY'
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
      existing.name = 'Roundabout Theatre Company (roundabouttheatre.org)'
      existing.config = CONFIG
      existing.consecutiveFailures = 0
      existing.disabledReason = undefined
      existing.isActive = true
      await existing.save()
      console.log('Updated Roundabout DataSource:', existing._id.toString())
      return
    }

    const ds = await DataSourceModel.create({
      name: 'Roundabout Theatre Company (roundabouttheatre.org)',
      type: 'scraper',
      url: CONFIG.startUrl,
      config: CONFIG,
      createdBy: admin._id,
      isActive: true,
      consecutiveFailures: 0,
      cooldownHours: 24
    })
    console.log('Created Roundabout DataSource:', ds._id.toString())
    console.log('  multi-venue — no single venue association; admin assigns per show')
  } finally {
    await mongoose.disconnect()
  }
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
