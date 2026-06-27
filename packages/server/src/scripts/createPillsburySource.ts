import '../config/env'
import mongoose from 'mongoose'
import { DataSourceModel } from '../entities/dataSource/dataSourceModel'
import { UserModel } from '../entities/user/userModel'
import { VenueModel } from '../entities/venue/venueModel'
import type { ScraperDataSourceConfig } from '../services/scraping/types'

// Pillsbury House + Theatre (pillsburyhouseandtheatre.org) — South Minneapolis.
// WordPress/Elementor. The /programs/productions/ page links each production to a
// /production/<slug>/ page (both the poster image and the date heading are anchors
// to it). The poster anchor has empty alt, so we discover via those anchors and
// take the anchor's own text (the date heading) as a throwaway title that the
// detail og:title overwrites; the empty-text poster anchors drop out as
// "missing title" and dedupe away.
//
// Each production page has og:title, a full og:description (synopsis), an og:image
// poster, and a run-date range in the body ("June 4–7 & June 11–14, 2026") whose
// opening date we take via date-range-start. Past productions are included
// (Curtn is an archive). ticketUrl points at the production page (has ticket info).

// Match a year-bearing date — a range ("September 21 – October 15, 2023",
// "June 4–7 & June 11–14, 2026") or a single date ("March 21, 2026"). Year-less
// ranges on older archived shows won't match (we exclude those below rather than
// stage a guessed year).
const RANGE_RX = '([A-Z][a-z]+\\s+\\d{1,2}[^<|]*?\\d{4})'

const CONFIG: ScraperDataSourceConfig = {
  startUrl: 'https://pillsburyhouseandtheatre.org/programs/productions/',
  strategy: {
    mode: 'template',
    template: {
      version: 2,
      nodes: [
        {
          type: 'container',
          id: 'events',
          label: 'Events',
          selector: 'a[href*="/production/"]',
          children: [
            { type: 'field', id: 'title', csvField: 'title', selector: ':self', transform: 'trim' },
            { type: 'field', id: 'ticketUrl', csvField: 'ticketUrl', selector: ':self', attribute: 'href', transform: 'trim' },
            { type: 'field', id: 'detailUrl', csvField: '_detailUrl', selector: ':self', attribute: 'href', transform: 'trim' }
          ]
        }
      ]
    }
  },
  rowDefaults: {
    venueName: 'Pillsbury House + Theatre',
    venueAddress: '3501 Chicago Ave',
    venueCity: 'Minneapolis',
    venueState: 'MN',
    venueZipCode: '55407',
    performanceTypes: 'theater'
  },
  maxItems: 40,
  // The /programs/productions/ page is "On Stage Now" (the current production) +
  // a "Past Productions" grid. Only the current show carries a clean, year-bearing
  // run-date in its detail body; the archived shows have year-less/inconsistent
  // dates that the body regex can't pin down (it otherwise grabs a page-chrome
  // year). So exclude the currently-archived slugs and ship the live production
  // only. NOTE: revisit when the lineup rotates — newly-past shows will need
  // adding here (or a date-model fix) to stay clean.
  excludeUrlPatterns: [
    '/production/drag-story-hour',
    '/production/a-lesson-in-love',
    '/production/a-walless-church',
    '/production/close-to-home',
    '/production/passage'
  ],
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
            { type: 'field', id: 'title', csvField: 'title', selector: 'meta[property="og:title"]', attribute: 'content', regex: '^(.+?)\\s*[-\\u2013|]\\s*Pillsbury', transform: 'trim' },
            { type: 'field', id: 'poster', csvField: 'showImageUrl', selector: 'meta[property="og:image"], meta[name="og:image"]', attribute: 'content', transform: 'trim' },
            { type: 'field', id: 'description', csvField: 'showDescription', selector: 'meta[property="og:description"], meta[name="og:description"]', attribute: 'content', transform: 'trim' },
            { type: 'field', id: 'date', csvField: 'date', selector: 'body', regex: RANGE_RX, transform: 'date-range-start' }
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
      console.log('Updated existing Pillsbury DataSource:', existing._id.toString())
      return
    }

    const venue = await VenueModel.findOne({ name: { $regex: /pillsbury/i } })

    const ds = await DataSourceModel.create({
      name: 'Pillsbury House + Theatre (pillsburyhouseandtheatre.org)',
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
    console.log('Created Pillsbury DataSource:', ds._id.toString())
    if (venue) console.log('  associated with venue:', venue._id.toString(), `(${venue.name})`)
  } finally {
    await mongoose.disconnect()
  }
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
