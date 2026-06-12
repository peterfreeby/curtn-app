import '../config/env'
import mongoose from 'mongoose'
import { DataSourceModel } from '../entities/dataSource/dataSourceModel'
import { UserModel } from '../entities/user/userModel'
import { VenueModel } from '../entities/venue/venueModel'
import type { ScraperDataSourceConfig } from '../services/scraping/types'

// Segerstrom Center for the Arts (scfta.org), Costa Mesa — Tier 2 template off the
// /shows-events listing (Algolia-rendered cards; Playwright sees them). Each
// .card-wrap is self-contained and rich:
//   .title           → title
//   .date            → run range ("May 5, 2026 - August 25, 2026")
//   .description     → full blurb
//   .event-category  → performanceTypes (Broadway / Dance / Music / ...)
//   .hide-on-mobile  → poster (imgix)
//   .image-container → canonical event page (/events/2026/<slug>)
//
// Detail pages are a client-rendered SPA (empty static shell), so we use the
// canonical event page as the ticketUrl — that's where the buy flow lives — and
// take everything else from the listing card. No detail fetch needed.

const CONFIG: ScraperDataSourceConfig = {
  startUrl: 'https://www.scfta.org/shows-events',
  strategy: {
    mode: 'template',
    template: {
      version: 2,
      nodes: [
        {
          type: 'container',
          id: 'events',
          label: 'Events',
          selector: '.card-wrap',
          children: [
            { type: 'field', id: 'title', csvField: 'title', selector: '.title', transform: 'trim' },
            { type: 'field', id: 'runStartDate', csvField: 'runStartDate', selector: '.date', transform: 'date-range-start' },
            { type: 'field', id: 'runEndDate', csvField: 'runEndDate', selector: '.date', transform: 'date-range-end' },
            { type: 'field', id: 'description', csvField: 'showDescription', selector: '.description', transform: 'trim' },
            { type: 'field', id: 'poster', csvField: 'showImageUrl', selector: '.hide-on-mobile', attribute: 'src', transform: 'trim' },
            // .image-container is a div wrapping the <a>; href is on the child.
            // The event page is the canonical buy page (detail is a JS SPA).
            { type: 'field', id: 'ticketUrl', csvField: 'ticketUrl', selector: '.image-container a', attribute: 'href', transform: 'trim' }
          ]
        }
      ]
    }
  },
  rowDefaults: {
    venueName: 'Segerstrom Center for the Arts',
    venueAddress: '600 Town Center Dr',
    venueCity: 'Costa Mesa',
    venueState: 'CA',
    venueZipCode: '92626'
  },
  maxItems: 50
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
      existing.config = CONFIG
      existing.consecutiveFailures = 0
      existing.disabledReason = undefined
      existing.isActive = true
      await existing.save()
      console.log('Updated existing Segerstrom DataSource:', existing._id.toString())
      return
    }
    const venue = await VenueModel.findOne({ name: { $regex: /segerstrom/i } })
    const ds = await DataSourceModel.create({
      name: 'Segerstrom Center for the Arts (scfta.org)',
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
    console.log('Created Segerstrom DataSource:', ds._id.toString())
    if (venue) console.log('  associated with venue:', venue._id.toString(), `(${venue.name})`)
  } finally {
    await mongoose.disconnect()
  }
}

main().catch(err => { console.error(err); process.exit(1) })
