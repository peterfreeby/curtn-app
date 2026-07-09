import '../config/env'
import mongoose from 'mongoose'
import { DataSourceModel } from '../entities/dataSource/dataSourceModel'
import { UserModel } from '../entities/user/userModel'
import { VenueModel } from '../entities/venue/venueModel'
import type { ScraperDataSourceConfig } from '../services/scraping/types'

// Apollo Theater (apollotheater.org) — Webflow CMS calendar.
//
// Triage: /calendar is the only live listing (/, /events, /shows 404). It's a
// Webflow collection: stable `.event-calendar_list-item` rows, each with a
// title, an ISO date (Finsweet filter fields), a "<venue> | <time>" string,
// a poster, and a /event/<slug> detail link. No JSON-LD on the listing.
//
// Each detail page DOES carry a schema.org Event JSON-LD (name, startDate,
// image, location, offers.url) — so we listing-scrape for the URL + time +
// run dates, then detail-fetch with jsonLd:true for the rich base and layer a
// small template on top to pull the FULL description (`.rt-body`, which the
// JSON-LD truncates to a one-line blurb).
//
// Venue note: the Apollo's main stage (253 W 125th) is dark this summer; the
// only upcoming events are Apollo-PRESENTED shows at partner sites (SummerStage
// in Central Park, Herbert Von King Park, Apollo Stages at The Victoria, …).
// We let the JSON-LD `location` carry the true per-event venue rather than
// forcing everything under "Apollo Theater"; rowDefaults is only a fallback for
// any row whose JSON-LD omits a location.

const APOLLO_CONFIG: ScraperDataSourceConfig = {
  startUrl: 'https://www.apollotheater.org/calendar',
  strategy: {
    mode: 'template',
    template: {
      version: 2,
      nodes: [
        {
          type: 'container',
          id: 'events',
          label: 'Events',
          selector: '.event-calendar_list-item',
          children: [
            {
              type: 'field',
              id: 'title',
              csvField: 'title',
              selector: '.event-calendar_title',
              transform: 'trim'
            },
            {
              // Finsweet date filter carries a clean ISO start date. jsonLd's
              // startDate ("Jul 16, 2026") overrides this on the detail pass;
              // both parse, so this is a safe base.
              type: 'field',
              id: 'date',
              csvField: 'date',
              selector: '.event-calendar_sub-title[fs-cmsfilter-range="from"]',
              transform: 'date'
            },
            {
              type: 'field',
              id: 'runStartDate',
              csvField: 'runStartDate',
              selector: '.event-calendar_sub-title[fs-cmsfilter-range="from"]',
              transform: 'date'
            },
            {
              // Second "to" range div is a w-dyn-bind-empty stub; the first
              // carries the real end date (== start for single-day events,
              // e.g. Aug 15→Aug 16 for the multi-day Harlem Week run).
              type: 'field',
              id: 'runEndDate',
              csvField: 'runEndDate',
              selector: '.event-calendar_sub-title[fs-cmsfilter-range="to"]',
              transform: 'date'
            },
            {
              // "Herbert Von King Park | 5:00PM" → capture the time after the
              // pipe. JSON-LD startDate is date-only, so the listing is the
              // ONLY time source.
              type: 'field',
              id: 'time',
              csvField: 'time',
              selector: '.event-calendar-time',
              regex: '\\|\\s*(.+)$',
              transform: 'time'
            },
            {
              type: 'field',
              id: 'poster',
              csvField: 'showImageUrl',
              selector: '.event-calendar_list-image',
              attribute: 'src',
              transform: 'trim'
            },
            {
              // Detail-page link → magic field consumed by the detail fetch,
              // stripped before staging. Relative (/event/<slug>) — resolved
              // against startUrl by the orchestrator.
              type: 'field',
              id: 'detailUrl',
              csvField: '_detailUrl',
              selector: 'a[href^="/event"]',
              attribute: 'href',
              transform: 'trim'
            }
          ]
        }
      ]
    }
  },
  rowDefaults: {
    // Fallback only — JSON-LD location wins per event. No street address here:
    // an empty JSON-LD streetAddress is dropped (not overridden), so a park
    // event would otherwise inherit the Apollo's street. Leave it for the
    // admin / JSON-LD to fill.
    venueName: 'Apollo Theater',
    venueCity: 'New York',
    venueState: 'NY',
    venueZipCode: '10027',
    venueWebsite: 'https://www.apollotheater.org',
    // Mixed music / comedy / dance / special-events bill; schema.org @type is
    // the generic "Event" (no perf-type mapping), so default to the catch-all.
    // jsonLd leaves performanceTypes undefined here, so this survives.
    performanceTypes: 'other'
  },
  maxItems: 50,
  detail: {
    fromField: '_detailUrl',
    fingerprint: ['title', 'date'],
    jsonLd: true, // name / startDate / image / location / offers.url + short description
    template: {
      version: 2,
      nodes: [
        {
          type: 'container',
          id: 'detail',
          label: 'Full description',
          // Anchor on html (matches exactly once) so the detail pass yields a
          // single fragment — `.event-details_right-content` appears twice per
          // page and would otherwise fan out duplicate rows.
          selector: 'html',
          children: [
            {
              // First .rt-body in the right column is the event's own full
              // description (later .rt-body blocks are partner-org boilerplate).
              // Overrides the truncated JSON-LD description.
              type: 'field',
              id: 'fullDescription',
              csvField: 'showDescription',
              selector: '.event-details_right-content .rt-body',
              transform: 'trim'
            }
          ]
        }
      ]
    },
    // If a single event's detail JSON-LD ever drops the image, keep the poster
    // the listing already captured instead of blanking it.
    fillIfEmpty: ['showImageUrl', 'performanceImageUrl']
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
      url: APOLLO_CONFIG.startUrl
    })
    if (existing) {
      existing.config = APOLLO_CONFIG
      existing.consecutiveFailures = 0
      existing.disabledReason = undefined
      existing.isActive = true
      await existing.save()
      console.log('Updated existing Apollo DataSource:', existing._id.toString())
      return
    }

    const venue = await VenueModel.findOne({
      name: { $regex: /^apollo theater$/i }
    })

    const ds = await DataSourceModel.create({
      name: 'Apollo Theater (apollotheater.org)',
      type: 'scraper',
      url: APOLLO_CONFIG.startUrl,
      config: APOLLO_CONFIG,
      associatedVenue: venue?._id,
      createdBy: admin._id,
      isActive: true,
      consecutiveFailures: 0,
      cooldownHours: 24
    })
    console.log('Created Apollo DataSource:', ds._id.toString())
    if (venue) console.log('  associated with venue:', venue._id.toString(), `(${venue.name})`)
    else console.log('  no existing Apollo venue found — scraper will create one on first run')
  } finally {
    await mongoose.disconnect()
  }
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
