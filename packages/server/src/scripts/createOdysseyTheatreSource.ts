import '../config/env'
import mongoose from 'mongoose'
import { DataSourceModel } from '../entities/dataSource/dataSourceModel'
import { UserModel } from '../entities/user/userModel'
import { VenueModel } from '../entities/venue/venueModel'
import type { ScraperDataSourceConfig } from '../services/scraping/types'

// Odyssey Theatre Ensemble (odysseytheatre.com) — WordPress, two-level scrape.
//
// Why the homepage and not /whats-on: /whats-on uses clean .show-listing__show
// markup but dumps ~110 mostly-PAST shows, and the pipeline has no past-date
// filter — it would flood the queue. The homepage `.home-feature--show` cards are
// exactly the current/upcoming productions (3 right now). The `.home-feature--page`
// cards (season/support links) are excluded by the --show modifier.
//
// Listing: each `.home-feature--show` IS the <a href="/whats-on/<slug>/">; inside,
// `.home-feature__title`, `.home-feature__date` ("Apr 29, 2026 – Jun 14, 2026",
// en-dash range), and `.home-feature__image img` (the real poster). Read the href
// off the container itself via :scope.
//
// Detail: og:image/og:description are generic venue boilerplate, so the poster
// comes from the listing and the synopsis from the detail page's stable
// `.show-text__synopsis`. The "Buy Tickets" CTA only has a real href on the detail
// page (`/tickets?eid=<id>`).

const ODYSSEY_CONFIG: ScraperDataSourceConfig = {
  startUrl: 'https://odysseytheatre.com/',
  strategy: {
    mode: 'template',
    template: {
      version: 2,
      nodes: [
        {
          type: 'container',
          id: 'events',
          label: 'Events',
          selector: '.home-feature--show',
          children: [
            {
              type: 'field',
              id: 'title',
              csvField: 'title',
              selector: '.home-feature__title',
              transform: 'trim'
            },
            {
              type: 'field',
              id: 'date',
              csvField: 'date',
              selector: '.home-feature__date',
              transform: 'date-range-start'
            },
            {
              type: 'field',
              id: 'runStart',
              csvField: 'runStartDate',
              selector: '.home-feature__date',
              transform: 'date-range-start'
            },
            {
              type: 'field',
              id: 'runEnd',
              csvField: 'runEndDate',
              selector: '.home-feature__date',
              transform: 'date-range-end'
            },
            {
              type: 'field',
              id: 'poster',
              csvField: 'showImageUrl',
              selector: '.home-feature__image img',
              attribute: 'src',
              transform: 'trim'
            },
            {
              type: 'field',
              id: 'detailUrl',
              csvField: '_detailUrl',
              selector: ':scope',
              attribute: 'href',
              transform: 'trim'
            }
          ]
        }
      ]
    }
  },
  rowDefaults: {
    venueName: 'Odyssey Theatre Ensemble',
    venueAddress: '2055 South Sepulveda Boulevard',
    venueCity: 'Los Angeles',
    venueState: 'CA',
    venueZipCode: '90025',
    performanceTypes: 'theater'
  },
  maxItems: 12,
  detail: {
    fromField: '_detailUrl',
    fingerprint: ['title'],
    template: {
      version: 2,
      nodes: [
        {
          type: 'field',
          id: 'ticketUrl',
          csvField: 'ticketUrl',
          selector: 'a[href*="/tickets?eid="]',
          attribute: 'href',
          transform: 'trim'
        },
        {
          type: 'field',
          id: 'description',
          csvField: 'showDescription',
          selector: '.show-text__synopsis',
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
    if (!admin) throw new Error('No admin user found — run setAdmin first')

    const existing = await DataSourceModel.findOne({
      type: 'scraper',
      url: ODYSSEY_CONFIG.startUrl
    })
    if (existing) {
      existing.config = ODYSSEY_CONFIG
      existing.consecutiveFailures = 0
      existing.disabledReason = undefined
      existing.isActive = true
      await existing.save()
      console.log('Updated existing Odyssey DataSource:', existing._id.toString())
      return
    }

    const venue = await VenueModel.findOne({ name: { $regex: /odyssey\s*theatre/i } })

    const ds = await DataSourceModel.create({
      name: 'Odyssey Theatre Ensemble (odysseytheatre.com)',
      type: 'scraper',
      url: ODYSSEY_CONFIG.startUrl,
      config: ODYSSEY_CONFIG,
      associatedVenue: venue?._id,
      createdBy: admin._id,
      isActive: true,
      consecutiveFailures: 0,
      cooldownHours: 24
    })
    console.log('Created Odyssey DataSource:', ds._id.toString())
    if (venue) console.log('  associated with venue:', venue._id.toString(), `(${venue.name})`)
    else console.log('  no existing Odyssey venue found — scraper will create one on first run')
  } finally {
    await mongoose.disconnect()
  }
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
