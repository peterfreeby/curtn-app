import '../config/env'
import mongoose from 'mongoose'
import { DataSourceModel } from '../entities/dataSource/dataSourceModel'
import { UserModel } from '../entities/user/userModel'
import { VenueModel } from '../entities/venue/venueModel'
import type { ScraperDataSourceConfig } from '../services/scraping/types'

// Open Eye Theatre (openeyetheatre.org) — South Minneapolis; figure/puppet theater
// + plays. Squarespace, no Event JSON-LD and no main-content show listing. But the
// current shows ARE enumerated in the "Shows & Events" header nav folder
// (#shows-events), where each item's anchor text is the show title and its href is
// the show page — so that folder is the discovery container. (The responsive theme
// renders the folder twice → duplicate rows; staging dedups them by title/date.)
//
// Each show page carries strong OG metadata: og:title, a full og:description, and a
// real og:image poster. The run date lives in a Squarespace text block as the first
// `.sqs-html-content h2` ("June 11 – 14, 2026"); a date-pattern regex + range-start
// transform pulls the opening date. (End part omits the month so runEndDate isn't
// reliably parseable — start date only, consistent with other multi-day houses.)
//
// NOTE: an occasional past/workshop item (e.g. a 2025 puppet workshop series) can
// surface with a stale date; the date regex + admin review keep those out. Default
// performanceTypes=theater (puppet/figure theater + plays dominate; an album-release
// night is the rare exception).

const DATE_RX = '([A-Za-z]+\\s+\\d{1,2}\\s*[\\u2013\\u2014-]\\s*(?:[A-Za-z]+\\s+)?\\d{1,2},?\\s*\\d{4})'

const CONFIG: ScraperDataSourceConfig = {
  startUrl: 'https://openeyetheatre.org/events',
  strategy: {
    mode: 'template',
    template: {
      version: 2,
      nodes: [
        {
          type: 'container',
          id: 'events',
          label: 'Events',
          selector: '#shows-events .header-nav-folder-item',
          children: [
            { type: 'field', id: 'title', csvField: 'title', selector: 'a', transform: 'trim' },
            { type: 'field', id: 'ticketUrl', csvField: 'ticketUrl', selector: 'a', attribute: 'href', transform: 'trim' },
            { type: 'field', id: 'detailUrl', csvField: '_detailUrl', selector: 'a', attribute: 'href', transform: 'trim' }
          ]
        }
      ]
    }
  },
  rowDefaults: {
    venueName: 'Open Eye Theatre',
    venueAddress: '506 E 24th St',
    venueCity: 'Minneapolis',
    venueState: 'MN',
    venueZipCode: '55404',
    performanceTypes: 'theater'
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
              id: 'date',
              csvField: 'date',
              selector: '.sqs-html-content h2',
              regex: DATE_RX,
              transform: 'date-range-start'
            },
            {
              type: 'field',
              id: 'poster',
              csvField: 'showImageUrl',
              selector: 'meta[property="og:image"], meta[name="og:image"]',
              attribute: 'content',
              transform: 'trim'
            },
            {
              type: 'field',
              id: 'description',
              csvField: 'showDescription',
              selector: 'meta[property="og:description"], meta[name="og:description"]',
              attribute: 'content',
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
      console.log('Updated existing Open Eye DataSource:', existing._id.toString())
      return
    }

    const venue = await VenueModel.findOne({ name: { $regex: /open eye/i } })

    const ds = await DataSourceModel.create({
      name: 'Open Eye Theatre (openeyetheatre.org)',
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
    console.log('Created Open Eye DataSource:', ds._id.toString())
    if (venue) console.log('  associated with venue:', venue._id.toString(), `(${venue.name})`)
  } finally {
    await mongoose.disconnect()
  }
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
