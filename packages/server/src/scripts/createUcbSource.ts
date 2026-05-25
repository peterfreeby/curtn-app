import '../config/env'
import mongoose from 'mongoose'
import { DataSourceModel } from '../entities/dataSource/dataSourceModel'
import { UserModel } from '../entities/user/userModel'
import { VenueModel } from '../entities/venue/venueModel'
import type { ScraperDataSourceConfig } from '../services/scraping/types'

// Tier 2 (template) — Upright Citizens Brigade, NYC + LA.
// Container: article.ucb-card ×88 on /shows/ (WP Grid Builder plugin).
// Location tag per card: .ucb-event-post-location span ("NYC" or "LA").
// Date: .event-post-date → "Friday, June 12 – Sunday, June 14, 2026".
// maxItems: 30 — UCB runs nightly; captures the next ~30 upcoming shows.
// rowDefaults left sparse since shows span NYC and LA venues.

const CONFIG: ScraperDataSourceConfig = {
  startUrl: 'https://ucbcomedy.com/shows/',
  strategy: {
    mode: 'template',
    template: {
      version: 2,
      nodes: [
        {
          type: 'container',
          id: 'events',
          label: 'Events',
          selector: 'article.ucb-card',
          children: [
            {
              type: 'field',
              id: 'title',
              csvField: 'title',
              selector: 'h3.ucb-event-post-title',
              transform: 'trim'
            },
            {
              // "NYC" or "LA" — stored as venueName placeholder; admin corrects.
              type: 'field',
              id: 'venueName',
              csvField: 'venueName',
              selector: '.ucb-event-post-location span',
              transform: 'trim'
            },
            {
              // "Friday, June 12 – Sunday, June 14, 2026" — stored raw.
              type: 'field',
              id: 'runStartDate',
              csvField: 'runStartDate',
              selector: '.event-post-date',
              transform: 'trim'
            },
            {
              type: 'field',
              id: 'ticketUrl',
              csvField: 'ticketUrl',
              selector: 'a[href*="/show/"]',
              attribute: 'href',
              transform: 'trim'
            },
            {
              type: 'field',
              id: 'showImageUrl',
              csvField: 'showImageUrl',
              selector: 'img.attachment-large',
              attribute: 'src',
              transform: 'trim'
            }
          ]
        }
      ]
    }
  },
  rowDefaults: {
    performanceTypes: 'comedy'
  },
  maxItems: 30
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
      existing.name = 'Upright Citizens Brigade (ucbcomedy.com)'
      existing.config = CONFIG
      existing.consecutiveFailures = 0
      existing.disabledReason = undefined
      existing.isActive = true
      await existing.save()
      console.log('Updated UCB DataSource:', existing._id.toString())
      return
    }

    const ds = await DataSourceModel.create({
      name: 'Upright Citizens Brigade (ucbcomedy.com)',
      type: 'scraper',
      url: CONFIG.startUrl,
      config: CONFIG,
      createdBy: admin._id,
      isActive: true,
      consecutiveFailures: 0,
      cooldownHours: 24
    })
    console.log('Created UCB DataSource:', ds._id.toString())
    console.log('  multi-city (NYC + LA) — venue name is city tag; admin assigns specific venues')
  } finally {
    await mongoose.disconnect()
  }
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
