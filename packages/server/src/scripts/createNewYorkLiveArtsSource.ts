import '../config/env'
import mongoose from 'mongoose'
import { DataSourceModel } from '../entities/dataSource/dataSourceModel'
import { UserModel } from '../entities/user/userModel'
import { VenueModel } from '../entities/venue/venueModel'
import type { ScraperDataSourceConfig } from '../services/scraping/types'

// New York Live Arts — Chelsea dance/performance house. WordPress + Elementor
// JetEngine listing at /events/. The grid mixes real events with press
// clippings; press items have no <h3> title link, so they drop on the
// "missing title" gate, leaving only real events. Date + subtitle live in
// heading widgets whose JetEngine template data-ids are stable across items.
// The detail page carries the full synopsis in a single
// .jet-listing-dynamic-field__content node (no JSON-LD), so we detail-follow.

const CONFIG: ScraperDataSourceConfig = {
  startUrl: 'https://newyorklivearts.org/events/',
  strategy: {
    mode: 'template',
    template: {
      version: 2,
      nodes: [
        {
          type: 'container',
          id: 'events',
          label: 'Events',
          selector: '.jet-listing-grid__item',
          children: [
            {
              type: 'field',
              id: 'title',
              csvField: 'title',
              selector: 'h3 a',
              transform: 'trim'
            },
            {
              // Date heading widget (template-stable JetEngine data-id). Text is
              // e.g. "September 10, 12-13, 7:30pm" — capture the start date.
              type: 'field',
              id: 'date',
              csvField: 'date',
              selector: '[data-id="7274265"]',
              regex: '^([A-Za-z]+\\s+\\d{1,2})',
              transform: 'date'
            },
            {
              type: 'field',
              id: 'time',
              csvField: 'time',
              selector: '[data-id="7274265"]',
              regex: '(\\d{1,2}(?::\\d{2})?\\s*[ap]m)',
              transform: 'time'
            },
            {
              // Subtitle heading = presenting artist / company.
              type: 'field',
              id: 'company',
              csvField: 'companyName',
              selector: '[data-id="9b38a97"]',
              transform: 'trim'
            },
            {
              // 16x9 event still (lazyload — engine falls through src→data-src).
              type: 'field',
              id: 'poster',
              csvField: 'showImageUrl',
              selector: 'img.attachment-nyla-16x9',
              attribute: 'src',
              transform: 'trim'
            },
            {
              // "More Info" button → external ticketing (Salesforce) or festival
              // page.
              type: 'field',
              id: 'ticketUrl',
              csvField: 'ticketUrl',
              selector: 'a.elementor-button',
              attribute: 'href',
              transform: 'trim'
            },
            {
              type: 'field',
              id: 'detailUrl',
              csvField: '_detailUrl',
              selector: 'h3 a',
              attribute: 'href',
              transform: 'trim'
            }
          ]
        }
      ]
    }
  },
  rowDefaults: {
    venueName: 'New York Live Arts',
    venueAddress: '219 West 19th Street',
    venueCity: 'New York',
    venueState: 'NY',
    venueZipCode: '10011',
    performanceTypes: 'dance'
  },
  maxItems: 50,
  detail: {
    fromField: '_detailUrl',
    fingerprint: ['title'],
    template: {
      version: 2,
      nodes: [
        {
          type: 'container',
          id: 'detail',
          label: 'Event detail',
          selector: 'body',
          children: [
            {
              // Single dynamic-field content node on the detail page = the full
              // synopsis.
              type: 'field',
              id: 'fullDescription',
              csvField: 'showDescription',
              selector: '.jet-listing-dynamic-field__content',
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

    const existing = await DataSourceModel.findOne({
      type: 'scraper',
      url: CONFIG.startUrl
    })
    if (existing) {
      existing.config = CONFIG
      existing.consecutiveFailures = 0
      existing.disabledReason = undefined
      existing.isActive = true
      await existing.save()
      console.log('Updated existing New York Live Arts DataSource:', existing._id.toString())
      return
    }

    const venue = await VenueModel.findOne({
      name: { $regex: /new york live arts/i }
    })

    const ds = await DataSourceModel.create({
      name: 'New York Live Arts (newyorklivearts.org)',
      type: 'scraper',
      url: CONFIG.startUrl,
      config: CONFIG,
      associatedVenue: venue?._id,
      createdBy: admin._id,
      isActive: true,
      consecutiveFailures: 0,
      cooldownHours: 24
    })
    console.log('Created New York Live Arts DataSource:', ds._id.toString())
    if (venue) console.log('  associated with venue:', venue._id.toString(), `(${venue.name})`)
    else console.log('  no existing venue found — scraper will create one on first run')
  } finally {
    await mongoose.disconnect()
  }
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
