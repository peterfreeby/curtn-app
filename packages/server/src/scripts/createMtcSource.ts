import '../config/env'
import mongoose from 'mongoose'
import { DataSourceModel } from '../entities/dataSource/dataSourceModel'
import { UserModel } from '../entities/user/userModel'
import { VenueModel } from '../entities/venue/venueModel'
import type { ScraperDataSourceConfig } from '../services/scraping/types'

// Tier 2 (template) — Manhattan Theatre Club, City Center / Samuel J. Friedman.
// /upcoming/ shows teaser cards for the current and next season.
// Container: .teaser4-wrap (empty ones have no innerText — template engine skips
// rows with no title, so blanks are naturally filtered).
// Image is a CSS background-image on .bg, not an <img> tag; extracted via
// attribute:'style' + regex to pull the URL from url(...) notation.
// No dates on the listing page — admin fills in at review.

const CONFIG: ScraperDataSourceConfig = {
  startUrl: 'https://www.manhattantheatreclub.com/upcoming/',
  strategy: {
    mode: 'template',
    template: {
      version: 2,
      nodes: [
        {
          type: 'container',
          id: 'events',
          label: 'Events',
          selector: '.teaser4-wrap',
          children: [
            {
              type: 'field',
              id: 'title',
              csvField: 'title',
              selector: 'h1',
              transform: 'trim'
            },
            {
              type: 'field',
              id: 'showDescription',
              csvField: 'showDescription',
              selector: '.info',
              transform: 'trim'
            },
            {
              type: 'field',
              id: 'ticketUrl',
              csvField: 'ticketUrl',
              selector: 'a.btn.learn_more',
              attribute: 'href',
              transform: 'trim'
            },
            {
              // Image is CSS background-image on .bg — no <img> tag.
              // Regex extracts the URL from "background:url(https://...)"
              type: 'field',
              id: 'showImageUrl',
              csvField: 'showImageUrl',
              selector: '.bg',
              attribute: 'style',
              regex: 'url\\(([^)]+)\\)',
              transform: 'trim'
            }
          ]
        }
      ]
    }
  },
  rowDefaults: {
    venueName: 'Manhattan Theatre Club',
    venueAddress: '131 W 55th St',
    venueCity: 'New York',
    venueState: 'NY',
    venueZipCode: '10019'
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
      existing.name = 'Manhattan Theatre Club (manhattantheatreclub.com)'
      existing.config = CONFIG
      existing.consecutiveFailures = 0
      existing.disabledReason = undefined
      existing.isActive = true
      await existing.save()
      console.log('Updated MTC DataSource:', existing._id.toString())
      return
    }

    const venue = await VenueModel.findOne({ name: { $regex: /manhattan theatre club/i } })

    const ds = await DataSourceModel.create({
      name: 'Manhattan Theatre Club (manhattantheatreclub.com)',
      type: 'scraper',
      url: CONFIG.startUrl,
      config: CONFIG,
      associatedVenue: venue?._id,
      createdBy: admin._id,
      isActive: true,
      consecutiveFailures: 0,
      cooldownHours: 24
    })
    console.log('Created MTC DataSource:', ds._id.toString())
    if (venue) console.log('  associated with venue:', venue._id.toString(), `(${venue.name})`)
    else console.log('  no existing MTC venue found — scraper will create one on first run')
  } finally {
    await mongoose.disconnect()
  }
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
