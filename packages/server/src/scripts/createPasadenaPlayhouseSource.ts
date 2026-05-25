import '../config/env'
import mongoose from 'mongoose'
import { DataSourceModel } from '../entities/dataSource/dataSourceModel'
import { UserModel } from '../entities/user/userModel'
import { VenueModel } from '../entities/venue/venueModel'
import type { ScraperDataSourceConfig } from '../services/scraping/types'

// Pasadena Playhouse (pasadenaplayhouse.org) — Tier 2 template off the season
// "collage" listing. Custom WordPress theme: the Tribe Events calendar/API is
// per-showtime noise (HTML-littered titles, no images), and detail /event/
// pages have TheaterEvent JSON-LD but inconsistent custom DOM for poster/cast.
//
// The SEASON page card is the clean source: each production is an
// <a href="/event/..."> with poster <img>, title (.collage-title), and a
// year-bearing run range (.collage-caption, "May 13 — June 14, 2026") — parsed
// with the date-range transforms. We run one source per season page.
//
// Known gap: cast + full synopsis live on the detail pages under inconsistent
// markup (.cast-toggle-item on some shows, .toggle-short-content bios on
// others, "Cast"/"Creative Team" h3 names) — deferred; the detail block below
// pulls the description best-effort. Re-author for cast when the theme settles
// or enrich via another source.

function seasonConfig(seasonUrl: string): ScraperDataSourceConfig {
  return {
    startUrl: seasonUrl,
    strategy: {
      mode: 'template',
      template: {
        version: 2,
        nodes: [
          {
            type: 'container',
            id: 'shows',
            label: 'Productions',
            // Each production is an anchor to its /event/ page.
            selector: 'a[href*="/event/"]',
            children: [
              { type: 'field', id: 'title', csvField: 'title', selector: '.collage-title', transform: 'trim' },
              {
                type: 'field',
                id: 'poster',
                csvField: 'showImageUrl',
                selector: 'img',
                attribute: 'src',
                transform: 'trim'
              },
              {
                // ".collage-caption" → "May 13 — June 14, 2026" (year-bearing).
                type: 'field',
                id: 'runStartDate',
                csvField: 'runStartDate',
                selector: '.collage-caption',
                transform: 'date-range-start'
              },
              {
                type: 'field',
                id: 'runEndDate',
                csvField: 'runEndDate',
                selector: '.collage-caption',
                transform: 'date-range-end'
              },
              {
                type: 'field',
                id: 'ticketUrl',
                csvField: 'ticketUrl',
                selector: ':scope',
                attribute: 'href',
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
      venueName: 'Pasadena Playhouse',
      venueAddress: '39 South El Molino Avenue',
      venueCity: 'Pasadena',
      venueState: 'CA',
      venueZipCode: '91101',
      performanceTypes: 'theater'
    },
    maxItems: 30,
    detail: {
      fromField: '_detailUrl',
      fingerprint: ['title'],
      template: {
        version: 2,
        nodes: [
          {
            type: 'container',
            id: 'detail',
            label: 'Show detail',
            selector: '.entry-content',
            children: [
              { type: 'field', id: 'desc', csvField: 'showDescription', selector: 'p', transform: 'trim' }
            ]
          }
        ]
      }
    }
  }
}

const SEASONS = [
  'https://www.pasadenaplayhouse.org/2025-2026-season/',
  'https://www.pasadenaplayhouse.org/2026-2027-season/'
]

async function upsert(seasonUrl: string, admin: any) {
  const config = seasonConfig(seasonUrl)
  const label = seasonUrl.match(/(\d{4}-\d{4})-season/)?.[1] ?? seasonUrl
  const existing = await DataSourceModel.findOne({ type: 'scraper', url: seasonUrl })
  if (existing) {
    existing.config = config
    existing.consecutiveFailures = 0
    existing.disabledReason = undefined
    existing.isActive = true
    await existing.save()
    console.log(`Updated Pasadena Playhouse (${label}):`, existing._id.toString())
    return
  }
  const venue = await VenueModel.findOne({ name: { $regex: /^pasadena playhouse$/i } })
  const ds = await DataSourceModel.create({
    name: `Pasadena Playhouse ${label} (pasadenaplayhouse.org)`,
    type: 'scraper',
    purpose: 'scraper',
    url: seasonUrl,
    config,
    associatedVenue: venue?._id,
    createdBy: admin._id,
    isActive: true,
    consecutiveFailures: 0,
    cooldownHours: 24
  })
  console.log(`Created Pasadena Playhouse (${label}):`, ds._id.toString())
}

async function main() {
  const mongoUrl = process.env.MONGODB_URL
  if (!mongoUrl) throw new Error('MONGODB_URL not set')
  await mongoose.connect(mongoUrl)
  try {
    const admin = await UserModel.findOne({ isAdmin: true })
    if (!admin) throw new Error('No admin user found — run setAdmin first')
    for (const s of SEASONS) await upsert(s, admin)
  } finally {
    await mongoose.disconnect()
  }
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
