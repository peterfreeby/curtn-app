import '../config/env'
import mongoose from 'mongoose'
import { DataSourceModel } from '../entities/dataSource/dataSourceModel'
import { UserModel } from '../entities/user/userModel'
import { VenueModel } from '../entities/venue/venueModel'
import type { ScraperDataSourceConfig } from '../services/scraping/types'

// REDCAT (Roy and Edna Disney CalArts Theater), DTLA — Tier 2 template off the
// /events grid. Modern Drupal + Tailwind site, no JSON-LD. Each event is an
// <a.event-card-stacked> carrying title (.title .pl-6), a year-less date range
// (.field--name-field-dates, "Jun 11 - Jun 13"), the performance type (.metier),
// a poster image, and its own href as the detail URL.
//
// REDCAT programs visual-art EXHIBITIONS alongside live performance; the card
// class encodes the discipline (descendant-dot:bg-visual-art vs bg-theater /
// bg-music / bg-dance). The container selector excludes visual-art so only live
// performances stage — this is a live-performance archive.
//
// Listing cards have no synopsis or ticket link, so a detail fetch pulls the full
// body description and the OvationTix ticket URL from each event page.

const CONFIG: ScraperDataSourceConfig = {
  startUrl: 'https://www.redcat.org/events',
  strategy: {
    mode: 'template',
    template: {
      version: 2,
      nodes: [
        {
          type: 'container',
          id: 'events',
          label: 'Events',
          // Exclude visual-art exhibitions; keep theater/music/dance cards.
          selector: 'a.event-card-stacked:not([class*="visual-art"])',
          children: [
            { type: 'field', id: 'title', csvField: 'title', selector: '.title .pl-6', transform: 'trim' },
            {
              // ".field--name-field-dates" → "Jun 11 - Jun 13" (no year → current
              // year via the range transform). Single-night events ("Jun 6") give
              // start === end.
              type: 'field',
              id: 'runStartDate',
              csvField: 'runStartDate',
              selector: '.field--name-field-dates',
              transform: 'date-range-start'
            },
            {
              type: 'field',
              id: 'runEndDate',
              csvField: 'runEndDate',
              selector: '.field--name-field-dates',
              transform: 'date-range-end'
            },
            { type: 'field', id: 'performanceTypes', csvField: 'performanceTypes', selector: '.metier', transform: 'trim' },
            {
              type: 'field',
              id: 'poster',
              csvField: 'showImageUrl',
              selector: '.field--name-field-media-image img',
              attribute: 'src',
              transform: 'trim'
            },
            { type: 'field', id: 'detailUrl', csvField: '_detailUrl', selector: ':scope', attribute: 'href', transform: 'trim' }
          ]
        }
      ]
    }
  },
  rowDefaults: {
    venueName: 'REDCAT',
    venueAddress: '631 W 2nd St',
    venueCity: 'Los Angeles',
    venueState: 'CA',
    venueZipCode: '90012'
  },
  maxItems: 50,
  detail: {
    fromField: '_detailUrl',
    fingerprint: ['title'],
    template: {
      version: 2,
      nodes: [
        {
          // Scope to the whole document (matches once → no row fan-out). The
          // visible body is JS-templated boilerplate; the full, clean synopsis
          // lives in <meta name="description">, and the OvationTix purchase link
          // is in a sticky CTA bar — both reachable from here.
          type: 'container',
          id: 'detail',
          label: 'Event detail',
          selector: 'html',
          children: [
            {
              type: 'field',
              id: 'desc',
              csvField: 'showDescription',
              selector: 'meta[name="description"]',
              attribute: 'content',
              transform: 'trim'
            },
            {
              type: 'field',
              id: 'ticketUrl',
              csvField: 'ticketUrl',
              selector: 'a[href*="ovationtix"]',
              attribute: 'href',
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
      console.log('Updated existing REDCAT DataSource:', existing._id.toString())
      return
    }

    const venue = await VenueModel.findOne({ name: { $regex: /^redcat$/i } })
    const ds = await DataSourceModel.create({
      name: 'REDCAT (redcat.org)',
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
    console.log('Created REDCAT DataSource:', ds._id.toString())
    if (venue) console.log('  associated with venue:', venue._id.toString(), `(${venue.name})`)
    else console.log('  no existing REDCAT venue found — scraper will create one on first run')
  } finally {
    await mongoose.disconnect()
  }
}

main().catch(err => { console.error(err); process.exit(1) })
