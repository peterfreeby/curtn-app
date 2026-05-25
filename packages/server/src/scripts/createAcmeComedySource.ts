import '../config/env'
import mongoose from 'mongoose'
import { DataSourceModel } from '../entities/dataSource/dataSourceModel'
import { UserModel } from '../entities/user/userModel'
import { VenueModel } from '../entities/venue/venueModel'
import type { ScraperDataSourceConfig } from '../services/scraping/types'

// Tier 2 (template) — Acme Comedy Co., Minneapolis Warehouse District.
// probeTemplate found .show (×12) on /shows/. Each card is one headliner run.
//
// Date quirk: Acme uses compact "month.start-end" notation (e.g. "5.21-23"
// means May 21–23). We capture the full string raw (no date transform) —
// the importEngine's date parser won't handle this format, so admin reviews
// and corrects dates at the /admin/incoming review step.
//
// The headliner name in .h--xs is the show title for a comedy club.
// Images are relative paths — the engine resolves them against startUrl.

const CONFIG: ScraperDataSourceConfig = {
  startUrl: 'https://acmecomedycompany.com/shows/',
  strategy: {
    mode: 'template',
    template: {
      version: 2,
      nodes: [
        {
          type: 'container',
          id: 'events',
          label: 'Events',
          selector: '.show',
          children: [
            {
              // Headliner name is the show "title" for a comedy club.
              type: 'field',
              id: 'title',
              csvField: 'title',
              selector: '.h--xs',
              transform: 'trim'
            },
            {
              // Compact date notation "5.21-23" (month.start-end).
              // Stored raw — admin fixes at review; no date transform applied.
              type: 'field',
              id: 'date',
              csvField: 'date',
              selector: '.split',
              transform: 'trim'
            },
            {
              type: 'field',
              id: 'ticketUrl',
              csvField: 'ticketUrl',
              selector: '.button',
              attribute: 'href',
              transform: 'trim'
            },
            {
              type: 'field',
              id: 'showImageUrl',
              csvField: 'showImageUrl',
              selector: '.show-headliner',
              attribute: 'src',
              transform: 'trim'
            }
          ]
        }
      ]
    }
  },
  rowDefaults: {
    venueName: 'Acme Comedy Co.',
    venueAddress: '708 N 1st St',
    venueCity: 'Minneapolis',
    venueState: 'MN',
    venueZipCode: '55401',
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
      existing.name = 'Acme Comedy Co. (acmecomedycompany.com)'
      existing.config = CONFIG
      existing.consecutiveFailures = 0
      existing.disabledReason = undefined
      existing.isActive = true
      await existing.save()
      console.log('Updated Acme Comedy DataSource:', existing._id.toString())
      return
    }

    const venue = await VenueModel.findOne({ name: { $regex: /acme comedy/i } })

    const ds = await DataSourceModel.create({
      name: 'Acme Comedy Co. (acmecomedycompany.com)',
      type: 'scraper',
      url: CONFIG.startUrl,
      config: CONFIG,
      associatedVenue: venue?._id,
      createdBy: admin._id,
      isActive: true,
      consecutiveFailures: 0,
      cooldownHours: 24
    })
    console.log('Created Acme Comedy DataSource:', ds._id.toString())
    if (venue) console.log('  associated with venue:', venue._id.toString(), `(${venue.name})`)
    else console.log('  no existing Acme Comedy venue found — scraper will create one on first run')
  } finally {
    await mongoose.disconnect()
  }
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
