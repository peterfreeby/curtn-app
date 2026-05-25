import '../config/env'
import mongoose from 'mongoose'
import { DataSourceModel } from '../entities/dataSource/dataSourceModel'
import { UserModel } from '../entities/user/userModel'
import { VenueModel } from '../entities/venue/venueModel'
import type { ScraperDataSourceConfig } from '../services/scraping/types'

// Tier 2 (template) — Center Theatre Group, Los Angeles.
// Covers three CTG venues: Ahmanson Theatre, Mark Taper Forum, Kirk Douglas Theatre.
// Container: .upcoming-events-item ×18 on /shows-tickets/ (Splide carousel, all slides
// pre-rendered in DOM). venueName extracted per card from .themed-location p.notranslate.
// Date "June 23 – July 19, 2026" stored raw as runStartDate.
// Image and detail URL are relative — engine resolves against startUrl.

const CONFIG: ScraperDataSourceConfig = {
  startUrl: 'https://www.centertheatregroup.org/shows-tickets/',
  waitFor: '.upcoming-events-item',
  strategy: {
    mode: 'template',
    template: {
      version: 2,
      nodes: [
        {
          type: 'container',
          id: 'events',
          label: 'Events',
          selector: '.upcoming-events-item',
          children: [
            {
              type: 'field',
              id: 'title',
              csvField: 'title',
              selector: 'h3.notranslate',
              transform: 'trim'
            },
            {
              // "Ahmanson Theatre", "Mark Taper Forum", or "Kirk Douglas Theatre"
              type: 'field',
              id: 'venueName',
              csvField: 'venueName',
              selector: '.themed-location p.notranslate',
              transform: 'trim'
            },
            {
              // "June 23 – July 19, 2026" — stored raw, admin corrects at review.
              type: 'field',
              id: 'runStartDate',
              csvField: 'runStartDate',
              selector: '.upcoming-events-info-item:last-child span',
              transform: 'trim'
            },
            {
              type: 'field',
              id: 'showDescription',
              csvField: 'showDescription',
              selector: '.rich-text p',
              transform: 'trim'
            },
            {
              type: 'field',
              id: 'ticketUrl',
              csvField: 'ticketUrl',
              selector: 'a.btn-themed',
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
    venueCity: 'Los Angeles',
    venueState: 'CA'
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
      existing.name = 'Center Theatre Group (centertheatregroup.org)'
      existing.config = CONFIG
      existing.consecutiveFailures = 0
      existing.disabledReason = undefined
      existing.isActive = true
      await existing.save()
      console.log('Updated CTG DataSource:', existing._id.toString())
      return
    }

    const ds = await DataSourceModel.create({
      name: 'Center Theatre Group (centertheatregroup.org)',
      type: 'scraper',
      url: CONFIG.startUrl,
      config: CONFIG,
      createdBy: admin._id,
      isActive: true,
      consecutiveFailures: 0,
      cooldownHours: 24
    })
    console.log('Created CTG DataSource:', ds._id.toString())
    console.log('  multi-venue (Ahmanson, Taper, Kirk Douglas) — venue name captured per card')
  } finally {
    await mongoose.disconnect()
  }
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
