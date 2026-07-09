import '../config/env'
import mongoose from 'mongoose'
import { DataSourceModel } from '../entities/dataSource/dataSourceModel'
import { UserModel } from '../entities/user/userModel'
import { VenueModel } from '../entities/venue/venueModel'
import type { ScraperDataSourceConfig } from '../services/scraping/types'

// Tier 2 (template) — New York Theatre Workshop, East Village.
// Container: .show_box ×8 on the season listing page.
// Run dates in h4.show_dates format "August 27, 2025—October 24, 2025" (em dash).
// Captured raw as runStartDate — admin splits or corrects at review.
//
// IMPORTANT: The season URL changes each year (2025-26-season → 2026-27-season).
// Update CONFIG.startUrl each June when NYTW announces the new season.
// waitFor: '.show_box' — JS-rendered; wait for first show card.

const CONFIG: ScraperDataSourceConfig = {
  startUrl: 'https://www.nytw.org/2025-26-season/',
  waitFor: '.show_box',
  strategy: {
    mode: 'template',
    template: {
      version: 2,
      nodes: [
        {
          type: 'container',
          id: 'events',
          label: 'Events',
          selector: '.show_box',
          children: [
            {
              type: 'field',
              id: 'title',
              csvField: 'title',
              selector: 'h2.show_name',
              transform: 'trim'
            },
            {
              // Raw "August 27, 2025—October 24, 2025" — stored as runStartDate.
              // Admin review needed: split into runStartDate + runEndDate.
              type: 'field',
              id: 'runStartDate',
              csvField: 'runStartDate',
              selector: 'h4.show_dates',
              transform: 'trim'
            },
            {
              type: 'field',
              id: 'ticketUrl',
              csvField: 'ticketUrl',
              selector: 'a[href*="/tickets/"]',
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
              // "More Info"/gallery link → the show's own page, where the full
              // synopsis lives. Exclude the sibling /tickets/ link.
              type: 'field',
              id: 'detailUrl',
              csvField: '_detailUrl',
              selector: 'a[href*="/show/"]:not([href*="/tickets/"])',
              attribute: 'href',
              transform: 'trim'
            }
          ]
        }
      ]
    }
  },
  rowDefaults: {
    venueName: 'New York Theatre Workshop',
    venueAddress: '79 E 4th St',
    venueCity: 'New York',
    venueState: 'NY',
    venueZipCode: '10003'
  },
  maxItems: 20,
  // The listing carries no synopsis; each show page's .show_description_expandee
  // holds the full blurb (og:description is generic boilerplate, so we don't use
  // it). Server-rendered WordPress — no hydration wait needed.
  detail: {
    fromField: '_detailUrl',
    fingerprint: ['title'],
    template: {
      version: 2,
      nodes: [
        {
          type: 'field',
          id: 'description',
          csvField: 'showDescription',
          selector: '.show_description_expandee',
          transform: 'trim'
        }
      ]
    }
  }
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
      existing.name = 'New York Theatre Workshop (nytw.org)'
      existing.config = CONFIG
      existing.consecutiveFailures = 0
      existing.disabledReason = undefined
      existing.isActive = true
      await existing.save()
      console.log('Updated NYTW DataSource:', existing._id.toString())
      return
    }

    const venue = await VenueModel.findOne({ name: { $regex: /new york theatre workshop/i } })

    const ds = await DataSourceModel.create({
      name: 'New York Theatre Workshop (nytw.org)',
      type: 'scraper',
      url: CONFIG.startUrl,
      config: CONFIG,
      associatedVenue: venue?._id,
      createdBy: admin._id,
      isActive: true,
      consecutiveFailures: 0,
      cooldownHours: 24
    })
    console.log('Created NYTW DataSource:', ds._id.toString())
    if (venue) console.log('  associated with venue:', venue._id.toString(), `(${venue.name})`)
    else console.log('  no existing NYTW venue found — scraper will create one on first run')
  } finally {
    await mongoose.disconnect()
  }
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
