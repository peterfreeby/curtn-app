import '../config/env'
import mongoose from 'mongoose'
import { DataSourceModel } from '../entities/dataSource/dataSourceModel'
import { UserModel } from '../entities/user/userModel'
import { VenueModel } from '../entities/venue/venueModel'
import type { ScraperDataSourceConfig } from '../services/scraping/types'

// Tier 2 (template) — Second Stage Theater, Hayes Theater (Broadway) +
// Pershing Square Signature Center (Off-Broadway).
// Container: section.show-short-data — typically 2-3 shows.
// No per-show detail links or poster images on the listing page; show title
// links are not present. Captures title and playwright credits only.
// Admin fills in dates, images, and URLs at review.
// Multi-venue: rowDefaults omits address since shows alternate between venues.

const CONFIG: ScraperDataSourceConfig = {
  startUrl: 'https://2st.com/shows',
  strategy: {
    mode: 'template',
    template: {
      version: 2,
      nodes: [
        {
          type: 'container',
          id: 'events',
          label: 'Events',
          selector: 'section.show-short-data',
          children: [
            {
              type: 'field',
              id: 'title',
              csvField: 'title',
              selector: 'h1',
              transform: 'trim'
            },
            {
              // "HAYES THEATER / BROADWAY" or "THE PERSHING SQUARE SIGNATURE CENTER / OFF-BROADWAY"
              type: 'field',
              id: 'venueName',
              csvField: 'venueName',
              selector: 'h5:nth-of-type(2)',
              transform: 'trim'
            },
            {
              // Playwright name
              type: 'field',
              id: 'showDescription',
              csvField: 'showDescription',
              selector: 'h3:first-of-type',
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
  maxItems: 10
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
      existing.name = 'Second Stage Theater (2st.com)'
      existing.config = CONFIG
      existing.consecutiveFailures = 0
      existing.disabledReason = undefined
      existing.isActive = true
      await existing.save()
      console.log('Updated Second Stage Theater DataSource:', existing._id.toString())
      return
    }

    const ds = await DataSourceModel.create({
      name: 'Second Stage Theater (2st.com)',
      type: 'scraper',
      url: CONFIG.startUrl,
      config: CONFIG,
      createdBy: admin._id,
      isActive: true,
      consecutiveFailures: 0,
      cooldownHours: 24
    })
    console.log('Created Second Stage Theater DataSource:', ds._id.toString())
    console.log('  multi-venue (Hayes + Pershing Square) — admin assigns correct venue per show')
  } finally {
    await mongoose.disconnect()
  }
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
