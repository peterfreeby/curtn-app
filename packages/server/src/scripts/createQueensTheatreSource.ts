import '../config/env'
import mongoose from 'mongoose'
import { DataSourceModel } from '../entities/dataSource/dataSourceModel'
import { UserModel } from '../entities/user/userModel'
import { VenueModel } from '../entities/venue/venueModel'
import type { ScraperDataSourceConfig } from '../services/scraping/types'

// Tier 2 (template) — Queens Theatre, Flushing Meadows Corona Park.
// Container: .eventCard ×5+ on /events/. Same Spektrix-based CMS as Joyce Theater.
// Run dates in .top-date ("Sat May 16 and Sun May 17"). Detail URL is relative.

const CONFIG: ScraperDataSourceConfig = {
  startUrl: 'https://www.queenstheatre.org/events',
  strategy: {
    mode: 'template',
    template: {
      version: 2,
      nodes: [
        {
          type: 'container',
          id: 'events',
          label: 'Events',
          selector: '.eventCard',
          children: [
            {
              type: 'field',
              id: 'title',
              csvField: 'title',
              selector: 'h3.title',
              transform: 'trim'
            },
            {
              // Stored raw — admin splits into runStartDate + runEndDate at review.
              type: 'field',
              id: 'runStartDate',
              csvField: 'runStartDate',
              selector: '.top-date',
              transform: 'trim'
            },
            {
              type: 'field',
              id: 'showDescription',
              csvField: 'showDescription',
              selector: '.tagline',
              transform: 'trim'
            },
            {
              type: 'field',
              id: 'ticketUrl',
              csvField: 'ticketUrl',
              selector: 'a[href*="/events/"]',
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
            },
            {
              // Detail-page URL — consumed by the detail fetch below (also the
              // ticketUrl fallback). Same href as ticketUrl, dedicated field.
              type: 'field',
              id: '_detailUrl',
              csvField: '_detailUrl',
              selector: 'a[href*="/events/"]',
              attribute: 'href',
              transform: 'trim'
            }
          ]
        }
      ]
    }
  },
  // The listing card's .tagline is only a short subtitle and is often empty,
  // so most rows staged with no description. The full blurb lives on each event
  // page in Spektrix's .richtext body; follow the detail URL and override.
  detail: {
    fromField: '_detailUrl',
    fingerprint: ['title'],
    template: {
      version: 2,
      nodes: [
        {
          type: 'container',
          id: 'detail',
          label: 'Event body',
          selector: 'body',
          children: [
            { type: 'field', id: 'showDescription', csvField: 'showDescription', selector: '.richtext', transform: 'trim' }
          ]
        }
      ]
    }
  },
  rowDefaults: {
    venueName: 'Queens Theatre',
    venueAddress: 'Flushing Meadows Corona Park',
    venueCity: 'Queens',
    venueState: 'NY',
    venueZipCode: '11368'
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
      existing.name = 'Queens Theatre (queenstheatre.org)'
      existing.config = CONFIG
      existing.consecutiveFailures = 0
      existing.disabledReason = undefined
      existing.isActive = true
      await existing.save()
      console.log('Updated Queens Theatre DataSource:', existing._id.toString())
      return
    }

    const venue = await VenueModel.findOne({ name: { $regex: /queens theatre/i } })

    const ds = await DataSourceModel.create({
      name: 'Queens Theatre (queenstheatre.org)',
      type: 'scraper',
      url: CONFIG.startUrl,
      config: CONFIG,
      associatedVenue: venue?._id,
      createdBy: admin._id,
      isActive: true,
      consecutiveFailures: 0,
      cooldownHours: 24
    })
    console.log('Created Queens Theatre DataSource:', ds._id.toString())
    if (venue) console.log('  associated with venue:', venue._id.toString(), `(${venue.name})`)
    else console.log('  no existing Queens Theatre venue found — scraper will create one on first run')
  } finally {
    await mongoose.disconnect()
  }
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
