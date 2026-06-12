import '../config/env'
import mongoose from 'mongoose'
import { DataSourceModel } from '../entities/dataSource/dataSourceModel'
import { UserModel } from '../entities/user/userModel'
import { VenueModel } from '../entities/venue/venueModel'
import type { ScraperDataSourceConfig } from '../services/scraping/types'

// Theatre in the Round Players (theatreintheround.org) — Minneapolis; the oldest
// continuously-running community theater in MN, year-round. WordPress/Elementor.
// The /2025-2026-season/ page presents each show as an Elementor image widget
// (a poster <a><img>), so the listing has the detail link but no title text — we
// take the img alt as a throwaway placeholder (so the row survives the pre-detail
// "missing title" drop) and let the detail og:title overwrite it.
//
// Each show page carries the real fields: og:title, og:image poster, and an
// All-in-One-SEO meta description shaped "<credits> | <run dates> | <synopsis>".
// The date segment (always the one containing a year) feeds date-range-start; the
// trailing synopsis segment becomes the blurb. (A couple of past-season shows use
// a no-space hyphen date that the range parser can't split — they'd misdate; new/
// current shows use "to"/en-dash and parse fine.)

const CONFIG: ScraperDataSourceConfig = {
  startUrl: 'https://www.theatreintheround.org/2025-2026-season/',
  strategy: {
    mode: 'template',
    template: {
      version: 2,
      nodes: [
        {
          type: 'container',
          id: 'events',
          label: 'Events',
          selector: '.elementor-widget-image',
          children: [
            // Placeholder title from the poster alt — overwritten by detail og:title.
            { type: 'field', id: 'title', csvField: 'title', selector: 'img', attribute: 'alt', transform: 'trim' },
            { type: 'field', id: 'poster', csvField: 'showImageUrl', selector: 'img', attribute: 'src', transform: 'trim' },
            { type: 'field', id: 'ticketUrl', csvField: 'ticketUrl', selector: 'a', attribute: 'href', transform: 'trim' },
            { type: 'field', id: 'detailUrl', csvField: '_detailUrl', selector: 'a', attribute: 'href', transform: 'trim' }
          ]
        }
      ]
    }
  },
  rowDefaults: {
    venueName: 'Theatre in the Round Players',
    venueAddress: '245 Cedar Ave',
    venueCity: 'Minneapolis',
    venueState: 'MN',
    venueZipCode: '55454',
    performanceTypes: 'theater'
  },
  // Only follow on-site show pages; skip the season page's non-show image links
  // (logo, ticketing CTA, sponsors) so they don't become rows.
  includeUrlPatterns: ['theatreintheround.org/'],
  // /prideandprejudice excluded: its SEO date uses a no-space hyphen
  // ("September 12-October 5, 2025") the range parser can't split, misdating it
  // to 2005. It's a past show; drop rather than stage a wrong date.
  excludeUrlPatterns: ['/home/', '/2025-2026-season', '/73rd-season', 'ludus.com', '/new-homepage', '/feed', '/prideandprejudice'],
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
            { type: 'field', id: 'title', csvField: 'title', selector: 'meta[property="og:title"]', attribute: 'content', regex: '^([^|]+?)\\s*\\|', transform: 'trim' },
            { type: 'field', id: 'poster', csvField: 'showImageUrl', selector: 'meta[property="og:image"], meta[name="og:image"]', attribute: 'content', transform: 'trim' },
            // meta description: "<credits> | <run dates> | <synopsis>".
            // Date = the segment containing a year.
            { type: 'field', id: 'date', csvField: 'date', selector: 'meta[name="description"]', attribute: 'content', regex: '\\|\\s*([A-Z][a-z]+\\s+\\d{1,2}[^|]*?\\d{4})', transform: 'date-range-start' },
            { type: 'field', id: 'runStart', csvField: 'runStartDate', selector: 'meta[name="description"]', attribute: 'content', regex: '\\|\\s*([A-Z][a-z]+\\s+\\d{1,2}[^|]*?\\d{4})', transform: 'date-range-start' },
            { type: 'field', id: 'runEnd', csvField: 'runEndDate', selector: 'meta[name="description"]', attribute: 'content', regex: '\\|\\s*([A-Z][a-z]+\\s+\\d{1,2}[^|]*?\\d{4})', transform: 'date-range-end' },
            // Synopsis = text after the 2nd pipe (absent on some shows → undefined).
            { type: 'field', id: 'desc', csvField: 'showDescription', selector: 'meta[name="description"]', attribute: 'content', regex: '\\|[^|]*\\|\\s*(.+)$', transform: 'trim' }
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
      console.log('Updated existing Theatre in the Round DataSource:', existing._id.toString())
      return
    }

    const venue = await VenueModel.findOne({ name: { $regex: /theatre in the round/i } })

    const ds = await DataSourceModel.create({
      name: 'Theatre in the Round (theatreintheround.org)',
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
    console.log('Created Theatre in the Round DataSource:', ds._id.toString())
    if (venue) console.log('  associated with venue:', venue._id.toString(), `(${venue.name})`)
  } finally {
    await mongoose.disconnect()
  }
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
