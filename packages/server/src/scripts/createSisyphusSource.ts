import '../config/env'
import mongoose from 'mongoose'
import { DataSourceModel } from '../entities/dataSource/dataSourceModel'
import { UserModel } from '../entities/user/userModel'
import { VenueModel } from '../entities/venue/venueModel'
import type { ScraperDataSourceConfig } from '../services/scraping/types'

// Sisyphus Brewing (Minneapolis) — brewery with a year-round comedy room. The
// site's /pages/events just embeds a dojour.us calendar widget, so we scrape the
// dojour embed directly. It's a client-rendered SPA, but Playwright hydrates it
// into clean `.embed-card`s: `.event-title`, an `.event-detail` line
// ("Saturday, June 6th, 8pm - 10pm" — regex out the date and the start time),
// an `.event-image` poster, and a card link to the dojour event page.
//
// Detail pages (/e/<id>/...) render a rich og:description (the comedian's bio)
// and og:image once hydrated, so detail-fetch overrides the thumbnail and adds
// the blurb. (A few recurring shows use /s/<id>/reserve links without a full
// detail page; those keep the listing poster and may lack a blurb.)

const CONFIG: ScraperDataSourceConfig = {
  startUrl: 'https://dojour.us/embed/u/sisyphusbrewing?cal_type=upcoming',
  strategy: {
    mode: 'template',
    template: {
      version: 2,
      nodes: [
        {
          type: 'container',
          id: 'events',
          label: 'Events',
          selector: '.embed-card',
          children: [
            { type: 'field', id: 'title', csvField: 'title', selector: '.event-title', transform: 'trim' },
            // "Saturday, June 6th, 8pm - 10pm" → date "June 6", start time "8pm".
            { type: 'field', id: 'date', csvField: 'date', selector: '.event-detail', regex: '([A-Z][a-z]+\\s+\\d{1,2})', transform: 'date' },
            { type: 'field', id: 'time', csvField: 'time', selector: '.event-detail', regex: '(\\d{1,2}(?::\\d{2})?\\s*[apAP][mM])', transform: 'time' },
            { type: 'field', id: 'poster', csvField: 'showImageUrl', selector: '.event-image img', attribute: 'src', transform: 'trim' },
            { type: 'field', id: 'ticketUrl', csvField: 'ticketUrl', selector: 'a', attribute: 'href', transform: 'trim' },
            { type: 'field', id: 'detailUrl', csvField: '_detailUrl', selector: 'a', attribute: 'href', transform: 'trim' }
          ]
        }
      ]
    }
  },
  rowDefaults: {
    venueName: 'Sisyphus Brewing',
    venueAddress: '712 Ontario Ave W',
    venueCity: 'Minneapolis',
    venueState: 'MN',
    venueZipCode: '55403',
    performanceTypes: 'comedy'
  },
  maxItems: 40,
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
          selector: 'html',
          children: [
            {
              type: 'field',
              id: 'poster',
              csvField: 'showImageUrl',
              selector: 'meta[property="og:image"], meta[name="og:image"]',
              attribute: 'content',
              transform: 'trim'
            },
            {
              // og:description is "8:00pm - 10:00pm at  | <bio>"; strip the time/
              // venue prefix up to the first pipe, leaving the real blurb.
              type: 'field',
              id: 'description',
              csvField: 'showDescription',
              selector: 'meta[property="og:description"], meta[name="og:description"]',
              attribute: 'content',
              regex: '(?:.*\\|\\s*)?([\\s\\S]+)',
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

    const existing = await DataSourceModel.findOne({ type: 'scraper', url: CONFIG.startUrl })
    if (existing) {
      existing.config = CONFIG
      existing.consecutiveFailures = 0
      existing.disabledReason = undefined
      existing.isActive = true
      await existing.save()
      console.log('Updated existing Sisyphus DataSource:', existing._id.toString())
      return
    }

    const venue = await VenueModel.findOne({ name: { $regex: /sisyphus/i } })

    const ds = await DataSourceModel.create({
      name: 'Sisyphus Brewing (dojour)',
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
    console.log('Created Sisyphus DataSource:', ds._id.toString())
    if (venue) console.log('  associated with venue:', venue._id.toString(), `(${venue.name})`)
  } finally {
    await mongoose.disconnect()
  }
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
