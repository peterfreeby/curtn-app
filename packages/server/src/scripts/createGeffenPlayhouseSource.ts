import '../config/env'
import mongoose from 'mongoose'
import { DataSourceModel } from '../entities/dataSource/dataSourceModel'
import { UserModel } from '../entities/user/userModel'
import { VenueModel } from '../entities/venue/venueModel'
import type { ScraperDataSourceConfig } from '../services/scraping/types'

// Tier 2 (template) — Geffen Playhouse, Westwood LA.
// Container: .show-card ×6 on /tickets/. UIkit-based site.
// Title: h1 (multi-word across lines — Cheerio .text() concatenates).
// Date: p.uk-h1.uk-text-primary → "06.10 – 07.12.2026" compact format — stored raw.
// h3 is a premiere/label tag ("Los Angeles Premiere") — captured as part of description.
// Ticket URL: a.uk-button-primary (Tessitura), detail URL: a.uk-button-secondary.

const CONFIG: ScraperDataSourceConfig = {
  startUrl: 'https://www.geffenplayhouse.org/tickets/',
  strategy: {
    mode: 'template',
    template: {
      version: 2,
      nodes: [
        {
          type: 'container',
          id: 'events',
          label: 'Events',
          selector: '.show-card',
          children: [
            {
              type: 'field',
              id: 'title',
              csvField: 'title',
              selector: 'h1',
              transform: 'trim'
            },
            {
              // Compact "06.10 – 07.12.2026" — stored raw, admin corrects at review.
              type: 'field',
              id: 'runStartDate',
              csvField: 'runStartDate',
              selector: 'p.uk-h1',
              transform: 'trim'
            },
            {
              type: 'field',
              id: 'showDescription',
              csvField: 'showDescription',
              selector: '.show-details-summary p',
              transform: 'trim'
            },
            {
              type: 'field',
              id: 'ticketUrl',
              csvField: 'ticketUrl',
              selector: 'a.uk-button-secondary',
              attribute: 'href',
              transform: 'trim'
            },
            {
              type: 'field',
              id: 'showImageUrl',
              csvField: 'showImageUrl',
              selector: 'img.uk-width-1-1',
              attribute: 'src',
              transform: 'trim'
            }
          ]
        }
      ]
    }
  },
  rowDefaults: {
    venueName: 'Geffen Playhouse',
    venueAddress: '10886 Le Conte Ave',
    venueCity: 'Los Angeles',
    venueState: 'CA',
    venueZipCode: '90024'
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
      existing.name = 'Geffen Playhouse (geffenplayhouse.org)'
      existing.config = CONFIG
      existing.consecutiveFailures = 0
      existing.disabledReason = undefined
      existing.isActive = true
      await existing.save()
      console.log('Updated Geffen Playhouse DataSource:', existing._id.toString())
      return
    }

    const venue = await VenueModel.findOne({ name: { $regex: /geffen playhouse/i } })

    const ds = await DataSourceModel.create({
      name: 'Geffen Playhouse (geffenplayhouse.org)',
      type: 'scraper',
      url: CONFIG.startUrl,
      config: CONFIG,
      associatedVenue: venue?._id,
      createdBy: admin._id,
      isActive: true,
      consecutiveFailures: 0,
      cooldownHours: 24
    })
    console.log('Created Geffen Playhouse DataSource:', ds._id.toString())
    if (venue) console.log('  associated with venue:', venue._id.toString(), `(${venue.name})`)
    else console.log('  no existing Geffen Playhouse venue found — scraper will create one on first run')
  } finally {
    await mongoose.disconnect()
  }
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
