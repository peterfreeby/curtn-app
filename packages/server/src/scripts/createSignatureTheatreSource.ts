import '../config/env'
import mongoose from 'mongoose'
import { DataSourceModel } from '../entities/dataSource/dataSourceModel'
import { UserModel } from '../entities/user/userModel'
import { VenueModel } from '../entities/venue/venueModel'
import type { ScraperDataSourceConfig } from '../services/scraping/types'

// Tier 2 (template) — Signature Theatre, Arlington VA.
// Container: .wp-block-post ×14 on /productions/.
// Date format: compact "05.05.26–06.14.26" (MM.DD.YY–MM.DD.YY with en dash).
// Stored raw as runStartDate — admin corrects at review. No standard date transform.
// Ticket URL links to the whole-season Tessitura page, not per-show — still
// useful as a fallback ticketing link. Per-show detail URL via a[href*="/show/"].
// waitFor: '.wp-block-post' — page is JS-rendered.

const CONFIG: ScraperDataSourceConfig = {
  startUrl: 'https://www.signaturetheatre.org/productions/',
  waitFor: '.wp-block-post',
  strategy: {
    mode: 'template',
    template: {
      version: 2,
      nodes: [
        {
          type: 'container',
          id: 'events',
          label: 'Events',
          selector: '.wp-block-post',
          children: [
            {
              type: 'field',
              id: 'title',
              csvField: 'title',
              selector: '.wp-block-post-title',
              transform: 'trim'
            },
            {
              // Compact "05.05.26–06.14.26" — stored raw, admin fixes at review.
              type: 'field',
              id: 'runStartDate',
              csvField: 'runStartDate',
              selector: '.wp-block-event-dates',
              transform: 'trim'
            },
            {
              type: 'field',
              id: 'showDescription',
              csvField: 'showDescription',
              selector: '.wp-block-paragraph',
              transform: 'trim'
            },
            {
              type: 'field',
              id: 'ticketUrl',
              csvField: 'ticketUrl',
              selector: 'a[href*="signaturetheatre.org/show/"]',
              attribute: 'href',
              transform: 'trim'
            },
            {
              type: 'field',
              id: 'showImageUrl',
              csvField: 'showImageUrl',
              selector: 'img.attachment-full',
              attribute: 'src',
              transform: 'trim'
            }
          ]
        }
      ]
    }
  },
  rowDefaults: {
    venueName: 'Signature Theatre',
    venueAddress: '4200 Campbell Ave',
    venueCity: 'Arlington',
    venueState: 'VA',
    venueZipCode: '22206'
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
      existing.name = 'Signature Theatre (signaturetheatre.org)'
      existing.config = CONFIG
      existing.consecutiveFailures = 0
      existing.disabledReason = undefined
      existing.isActive = true
      await existing.save()
      console.log('Updated Signature Theatre DataSource:', existing._id.toString())
      return
    }

    const venue = await VenueModel.findOne({ name: { $regex: /signature theatre/i } })

    const ds = await DataSourceModel.create({
      name: 'Signature Theatre (signaturetheatre.org)',
      type: 'scraper',
      url: CONFIG.startUrl,
      config: CONFIG,
      associatedVenue: venue?._id,
      createdBy: admin._id,
      isActive: true,
      consecutiveFailures: 0,
      cooldownHours: 24
    })
    console.log('Created Signature Theatre DataSource:', ds._id.toString())
    if (venue) console.log('  associated with venue:', venue._id.toString(), `(${venue.name})`)
    else console.log('  no existing Signature Theatre venue found — scraper will create one on first run')
  } finally {
    await mongoose.disconnect()
  }
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
