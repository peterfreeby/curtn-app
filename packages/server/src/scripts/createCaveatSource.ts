import '../config/env'
import mongoose from 'mongoose'
import { DataSourceModel } from '../entities/dataSource/dataSourceModel'
import { UserModel } from '../entities/user/userModel'
import { VenueModel } from '../entities/venue/venueModel'
import type { ScraperDataSourceConfig } from '../services/scraping/types'

// One-shot script: create a DataSource doc for caveat.nyc/ with a hand-authored
// V2 template using stable selectors (custom Caveat classes + attribute-based
// + adjacent-sibling, deliberately avoiding CSS-in-JS hashes that regenerate).

const CAVEAT_CONFIG: ScraperDataSourceConfig = {
  startUrl: 'https://caveat.nyc/',
  strategy: {
    mode: 'template',
    template: {
      version: 2,
      nodes: [
        {
          type: 'container',
          id: 'events',
          label: 'Events',
          selector: '.MuiCard-root',
          children: [
            {
              type: 'field',
              id: 'title',
              csvField: 'title',
              selector: '.show-title',
              transform: 'trim'
            },
            {
              // Match any external link (Stellar Tickets, Eventbrite, etc).
              // The card's own click target is href="/events/..." (relative),
              // so href^="http" cleanly excludes it.
              type: 'field',
              id: 'ticketUrl',
              csvField: 'ticketUrl',
              selector: 'a[href^="http"]',
              attribute: 'href',
              transform: 'trim'
            },
            {
              type: 'field',
              id: 'date',
              csvField: 'date',
              selector: '.MuiTypography-h5',
              transform: 'date'
            },
            {
              type: 'field',
              id: 'time',
              csvField: 'time',
              selector: '.MuiTypography-h5 + .MuiTypography-h5',
              transform: 'time'
            },
            {
              // Listing description is truncated; detail-fetch overrides it.
              type: 'field',
              id: 'showDescription',
              csvField: 'showDescription',
              selector: '.MuiTypography-body:not(.MuiLink-root)',
              transform: 'trim'
            },
            {
              // Poster URL is in CSS background-image on MuiCardMedia. The
              // regex captures whatever is inside url("...") — quotes optional.
              type: 'field',
              id: 'poster',
              csvField: 'showImageUrl',
              selector: '.MuiCardMedia-root',
              attribute: 'style',
              // Quote-anchored: capture everything between the quotes inside
              // url("..."). Avoids truncating on legal '(' or ')' in filenames.
              regex: 'url\\(["\']([^"\']+)["\']\\)',
              transform: 'trim'
            },
            {
              // Card outer link → detail page URL. Captured into a magic field
              // the orchestrator picks up; stripped before staging.
              type: 'field',
              id: 'detailUrl',
              csvField: '_detailUrl',
              selector: 'a.MuiCardActionArea-root',
              attribute: 'href',
              transform: 'trim'
            }
          ]
        }
      ]
    }
  },
  rowDefaults: {
    venueName: 'Caveat',
    venueAddress: '21A Clinton St',
    venueCity: 'New York',
    venueState: 'NY',
    venueZipCode: '10002'
  },
  maxItems: 50,
  detail: {
    fromField: '_detailUrl',
    fingerprint: ['title', 'date'],
    template: {
      version: 2,
      nodes: [
        {
          type: 'container',
          id: 'detail',
          label: 'Event detail',
          // The detail page main column has a stable nested structure: the
          // first MuiBox-root.css-0 inside the md-8 grid is the description.
          selector: '.MuiGrid-grid-md-8',
          children: [
            {
              type: 'field',
              id: 'fullDescription',
              csvField: 'showDescription',
              selector: '.MuiBox-root.css-0',
              transform: 'trim'
            }
          ]
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

    // Reuse existing DataSource if one already points at caveat.nyc
    const existing = await DataSourceModel.findOne({
      type: 'scraper',
      url: CAVEAT_CONFIG.startUrl
    })
    if (existing) {
      existing.config = CAVEAT_CONFIG
      existing.consecutiveFailures = 0
      existing.disabledReason = undefined
      existing.isActive = true
      await existing.save()
      console.log('Updated existing Caveat DataSource:', existing._id.toString())
      return
    }

    // Try to associate with an existing Caveat venue if we already have one
    const venue = await VenueModel.findOne({
      name: { $regex: /^caveat$/i }
    })

    const ds = await DataSourceModel.create({
      name: 'Caveat (caveat.nyc)',
      type: 'scraper',
      url: CAVEAT_CONFIG.startUrl,
      config: CAVEAT_CONFIG,
      associatedVenue: venue?._id,
      createdBy: admin._id,
      isActive: true,
      consecutiveFailures: 0,
      cooldownHours: 24
    })
    console.log('Created Caveat DataSource:', ds._id.toString())
    if (venue) console.log('  associated with venue:', venue._id.toString(), `(${venue.name})`)
    else console.log('  no existing Caveat venue found — scraper will create one on first run')
  } finally {
    await mongoose.disconnect()
  }
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
