import '../config/env'
import mongoose from 'mongoose'
import { DataSourceModel } from '../entities/dataSource/dataSourceModel'
import { UserModel } from '../entities/user/userModel'
import { VenueModel } from '../entities/venue/venueModel'
import type { ScraperDataSourceConfig } from '../services/scraping/types'

// BAM (Brooklyn Academy of Music) — bam.org/calendar.
// Listing-only V2 template using BAM's stable semantic class names. BAM's
// markup is a refreshing contrast to Caveat: data-date attribute on each
// .eventBlock, semantic class names like .listModuleTitleMed, no CSS-in-JS
// hashes anywhere. Detail-following (descriptions + posters) deferred to a
// follow-up — calendar pages already give us enough to populate PendingImport.

const BAM_CONFIG: ScraperDataSourceConfig = {
  startUrl: 'https://www.bam.org/calendar',
  strategy: {
    mode: 'template',
    template: {
      version: 2,
      nodes: [
        {
          type: 'container',
          id: 'events',
          label: 'Events',
          selector: '.eventBlock',
          children: [
            {
              type: 'field',
              id: 'title',
              csvField: 'title',
              selector: '.listModuleTitleMed',
              transform: 'trim'
            },
            {
              // Container has data-date as ISO-ish: "2026-05-08T00:00:00-04:00"
              type: 'field',
              id: 'date',
              csvField: 'date',
              selector: ':scope',                       // the .eventBlock itself
              attribute: 'data-date',
              transform: 'date'
            },
            {
              // First showtime out of a comma-separated list "1:30pm, 4:40pm, 7:45pm"
              type: 'field',
              id: 'time',
              csvField: 'time',
              selector: '.timeList li',
              regex: '(\\d{1,2}:\\d{2}\\s*(?:am|pm)?)',
              transform: 'time'
            },
            {
              // The card-wrapping <a> goes to BAM's own detail page; treat as
              // the ticket destination for now. (BAM sells tickets through
              // their own site so the detail page has a "Buy tickets" CTA.)
              type: 'field',
              id: 'ticketUrl',
              csvField: 'ticketUrl',
              selector: 'a',
              attribute: 'href',
              transform: 'trim'
            }
          ]
        }
      ]
    }
  },
  rowDefaults: {
    venueName: 'BAM',
    venueAddress: '30 Lafayette Ave',
    venueCity: 'Brooklyn',
    venueState: 'NY',
    venueZipCode: '11217'
  },
  maxItems: 100,
  // BAM lumps film, music, kids, classes, galas, and community events on the
  // same /calendar page mixed in with the performing arts we want. Exclude
  // those category prefixes; theater/dance/talks/opera/performance-art pass.
  excludeUrlPatterns: [
    '/film/',
    '/music/',
    '/kids/',
    '/classes/',
    '/galas/',
    '/community/'
  ]
}

async function main() {
  const mongoUrl = process.env.MONGODB_URL
  if (!mongoUrl) throw new Error('MONGODB_URL not set')
  await mongoose.connect(mongoUrl)

  try {
    const admin = await UserModel.findOne({ isAdmin: true })
    if (!admin) throw new Error('No admin user found')

    const existing = await DataSourceModel.findOne({
      type: 'scraper',
      url: BAM_CONFIG.startUrl
    })
    if (existing) {
      existing.config = BAM_CONFIG
      existing.consecutiveFailures = 0
      existing.disabledReason = undefined
      existing.isActive = true
      await existing.save()
      console.log('Updated existing BAM DataSource:', existing._id.toString())
      return
    }

    const venue = await VenueModel.findOne({
      name: { $regex: /^bam$/i }
    }) || await VenueModel.findOne({
      name: { $regex: /brooklyn academy/i }
    })

    const ds = await DataSourceModel.create({
      name: 'BAM (bam.org/calendar)',
      type: 'scraper',
      url: BAM_CONFIG.startUrl,
      config: BAM_CONFIG,
      associatedVenue: venue?._id,
      createdBy: admin._id,
      isActive: true,
      consecutiveFailures: 0,
      cooldownHours: 24
    })
    console.log('Created BAM DataSource:', ds._id.toString())
    if (venue) console.log('  associated with venue:', venue._id.toString(), `(${venue.name})`)
    else console.log('  no existing BAM venue found — scraper will create one on first run')
  } finally {
    await mongoose.disconnect()
  }
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
