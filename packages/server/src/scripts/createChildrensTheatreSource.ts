import '../config/env'
import mongoose from 'mongoose'
import { DataSourceModel } from '../entities/dataSource/dataSourceModel'
import { UserModel } from '../entities/user/userModel'
import { VenueModel } from '../entities/venue/venueModel'
import type { ScraperDataSourceConfig } from '../services/scraping/types'

// Children's Theatre Company (childrenstheatre.org) — Tier 2 template with
// detail-page fetch for full description + cast/creative bios.
//
// Listing (/shows-and-tickets/) is a BEM-class WordPress theme: each show is a
// .c-col-card with title, run-date range, poster, and a /whats-on/<slug> link.
// Detail pages carry the full synopsis (.c-col-text-area) and a bios grid
// (.c-col-biographies__single = headshot + name + role) covering cast + creative.
//
// Run dates: the card shows "April 21–June 14, 2026". We capture the end date
// (year-bearing → parses cleanly) and the start ("April 21"); the start has no
// year, so the date transform infers it — fine for upcoming shows, slightly
// fragile for one already mid-run near a year boundary (verify on dry-run).

const CONFIG: ScraperDataSourceConfig = {
  startUrl: 'https://childrenstheatre.org/shows-and-tickets/',
  strategy: {
    mode: 'template',
    template: {
      version: 2,
      nodes: [
        {
          type: 'container',
          id: 'shows',
          label: 'Shows',
          selector: '.c-col-card',
          children: [
            {
              type: 'field',
              id: 'title',
              csvField: 'title',
              // h1.c-col-title is the title; h4.c-col-title--small is the date — exclude it.
              selector: '.c-col-title:not(.c-col-title--small)',
              transform: 'trim'
            },
            {
              // "April 21–June 14, 2026" → range-aware: the trailing year
              // applies to both ends, so the start isn't year-rolled-forward.
              type: 'field',
              id: 'runStartDate',
              csvField: 'runStartDate',
              selector: '.c-col-title--small',
              transform: 'date-range-start'
            },
            {
              type: 'field',
              id: 'runEndDate',
              csvField: 'runEndDate',
              selector: '.c-col-title--small',
              transform: 'date-range-end'
            },
            {
              type: 'field',
              id: 'poster',
              csvField: 'showImageUrl',
              selector: '.c-col-card__fig img',
              attribute: 'src',
              // src is a lazyload placeholder with ?resize=...; capture the
              // full-res original (everything before the query string).
              regex: '(https://images\\.childrenstheatre\\.org/uploads/\\S+?\\.(?:jpg|jpeg|png|webp))',
              transform: 'trim'
            },
            {
              type: 'field',
              id: 'detailUrl',
              csvField: '_detailUrl',
              selector: 'a[href*="/whats-on/"]',
              attribute: 'href',
              transform: 'trim'
            }
          ]
        }
      ]
    }
  },
  rowDefaults: {
    venueName: 'Children’s Theatre Company',
    venueAddress: '2400 3rd Avenue South',
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
          label: 'Show detail',
          // Broad container: the description text-area and the bios grid live in
          // different parts of the page; scope from a wrapper that holds both.
          selector: 'body',
          children: [
            {
              type: 'field',
              id: 'fullDescription',
              csvField: 'showDescription',
              selector: '.c-col-text-area',
              transform: 'trim'
            },
            {
              type: 'container',
              id: 'bios',
              label: 'Cast & creative',
              // One row per bio (cast + creative). When a show has no bios grid
              // this matches zero and the parent's single row stands.
              selector: '.c-col-biographies__single',
              children: [
                {
                  type: 'field',
                  id: 'personName',
                  csvField: 'personName',
                  selector: 'h5.c-col-title',
                  transform: 'trim'
                },
                {
                  type: 'field',
                  id: 'personRole',
                  csvField: 'personRole',
                  selector: 'p.c-col-subtitle',
                  transform: 'trim'
                },
                {
                  type: 'field',
                  id: 'personHeadshotUrl',
                  csvField: 'personHeadshotUrl',
                  selector: 'img.lazyload',
                  attribute: 'src',
                  regex: '(https://images\\.childrenstheatre\\.org/uploads/\\S+?\\.(?:jpg|jpeg|png|webp))',
                  transform: 'trim'
                }
              ]
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
      console.log('Updated existing Children’s Theatre DataSource:', existing._id.toString())
      return
    }

    const venue = await VenueModel.findOne({ name: { $regex: /^children.?s theatre/i } })
    const ds = await DataSourceModel.create({
      name: 'Children’s Theatre Company (childrenstheatre.org)',
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
    console.log('Created Children’s Theatre DataSource:', ds._id.toString())
    if (venue) console.log('  associated with venue:', venue._id.toString(), `(${venue.name})`)
  } finally {
    await mongoose.disconnect()
  }
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
