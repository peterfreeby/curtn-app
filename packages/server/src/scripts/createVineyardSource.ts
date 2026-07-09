import '../config/env'
import mongoose from 'mongoose'
import { DataSourceModel } from '../entities/dataSource/dataSourceModel'
import { UserModel } from '../entities/user/userModel'
import { VenueModel } from '../entities/venue/venueModel'
import type { ScraperDataSourceConfig } from '../services/scraping/types'

// Tier 2 (template) — Vineyard Theatre, Union Square NYC.
// Container: .upcoming-square on /showsevents/ — typically 2-4 shows per season.
// Title split across <span> tags inside h2 — Cheerio .text() concatenates them.
// Run dates are in the last h5 ("May 12 - June 21" or "BEGINS OCTOBER 2026").
// Detail URL via a[href*="/shows/"]. No poster images in listing cards.

const CONFIG: ScraperDataSourceConfig = {
  startUrl: 'https://www.vineyardtheatre.org/showsevents/',
  strategy: {
    mode: 'template',
    template: {
      version: 2,
      nodes: [
        {
          type: 'container',
          id: 'events',
          label: 'Events',
          selector: '.upcoming-square',
          children: [
            {
              type: 'field',
              id: 'title',
              csvField: 'title',
              selector: 'h2',
              transform: 'trim'
            },
            {
              // Last h5 is run dates ("May 12 - June 21") — stored raw.
              type: 'field',
              id: 'runStartDate',
              csvField: 'runStartDate',
              selector: 'h5:last-of-type',
              transform: 'trim'
            },
            {
              type: 'field',
              id: 'ticketUrl',
              csvField: 'ticketUrl',
              selector: 'a[href*="/shows/"]',
              attribute: 'href',
              transform: 'trim'
            },
            {
              // The show page — followed for the synopsis + poster, neither of
              // which is on the listing card.
              type: 'field',
              id: 'detailUrl',
              csvField: '_detailUrl',
              selector: 'a[href*="/shows/"]',
              attribute: 'href',
              transform: 'trim'
            }
          ]
        }
      ]
    }
  },
  detail: {
    fromField: '_detailUrl',
    fingerprint: ['title'],
    // No og tags on Vineyard show pages. The synopsis is the .show-hero text
    // block; the poster is a CSS background-image on .image-display--cover.
    template: {
      version: 2,
      nodes: [
        {
          type: 'container',
          id: 'detail',
          label: 'Show detail',
          selector: 'html',
          children: [
            { type: 'field', id: 'desc', csvField: 'showDescription', selector: '.show-hero .col-md-8', transform: 'trim' },
            { type: 'field', id: 'img', csvField: 'showImageUrl', selector: '.show-hero .image-display--cover.desktop', attribute: 'style', regex: 'url\\((https://[^)]+)\\)', transform: 'trim' },
            { type: 'field', id: 'img2', csvField: 'performanceImageUrl', selector: '.show-hero .image-display--cover.desktop', attribute: 'style', regex: 'url\\((https://[^)]+)\\)', transform: 'trim' }
          ]
        }
      ]
    }
  },
  cleanup: {
    // Peel the membership CTA off the tail of the .show-hero text block.
    descriptionStripPatterns: ['\\s*Join us for the [\\s\\S]*$', '\\s*Become a Vineyard Member[\\s\\S]*$']
  },
  rowDefaults: {
    venueName: 'Vineyard Theatre',
    venueAddress: '108 E 15th St',
    venueCity: 'New York',
    venueState: 'NY',
    venueZipCode: '10003'
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
      existing.name = 'Vineyard Theatre (vineyardtheatre.org)'
      existing.config = CONFIG
      existing.consecutiveFailures = 0
      existing.disabledReason = undefined
      existing.isActive = true
      await existing.save()
      console.log('Updated Vineyard Theatre DataSource:', existing._id.toString())
      return
    }

    const venue = await VenueModel.findOne({ name: { $regex: /vineyard theatre/i } })

    const ds = await DataSourceModel.create({
      name: 'Vineyard Theatre (vineyardtheatre.org)',
      type: 'scraper',
      url: CONFIG.startUrl,
      config: CONFIG,
      associatedVenue: venue?._id,
      createdBy: admin._id,
      isActive: true,
      consecutiveFailures: 0,
      cooldownHours: 24
    })
    console.log('Created Vineyard Theatre DataSource:', ds._id.toString())
    if (venue) console.log('  associated with venue:', venue._id.toString(), `(${venue.name})`)
    else console.log('  no existing Vineyard Theatre venue found — scraper will create one on first run')
  } finally {
    await mongoose.disconnect()
  }
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
