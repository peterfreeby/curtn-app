import '../config/env'
import mongoose from 'mongoose'
import { DataSourceModel } from '../entities/dataSource/dataSourceModel'
import { UserModel } from '../entities/user/userModel'
import { VenueModel } from '../entities/venue/venueModel'
import type { ScraperDataSourceConfig } from '../services/scraping/types'

// Tier 2 (template) + detail-follow — Triskelion Arts, Williamsburg.
// Squarespace, but a custom /spring-2026-performances page (not the standard
// .eventlist block), linking to /spring-2026-performances/<slug>. No Event
// JSON-LD; the detail page carries everything as text/meta: the <title> /
// og:title is "ARTIST | JUNE 11-13", the body has the run dates + showtime
// ("JUNE 11-13, 8PM"), and og:image is the poster. We pull title/poster from
// meta and date/time by regex off the body. Description prose is in the
// Squarespace html block.

const CONFIG: ScraperDataSourceConfig = {
  startUrl: 'https://www.triskelionarts.org/spring-2026-performances',
  strategy: {
    mode: 'template',
    template: {
      version: 2,
      nodes: [
        {
          type: 'container',
          id: 'events',
          label: 'Events',
          selector: 'a[href*="/spring-2026-performances/"]',
          children: [
            {
              type: 'field',
              id: 'title',
              csvField: 'title',
              selector: ':scope',
              transform: 'trim'
            },
            {
              type: 'field',
              id: 'detailUrl',
              csvField: '_detailUrl',
              selector: ':scope',
              attribute: 'href',
              transform: 'trim'
            },
            {
              type: 'field',
              id: 'ticketUrl',
              csvField: 'ticketUrl',
              selector: ':scope',
              attribute: 'href',
              transform: 'trim'
            }
          ]
        }
      ]
    }
  },
  // /spring-2026-performances/support is the "Support Trisk" donation CTA, not a
  // show — it matches the grid-item anchor but carries no synopsis, so drop it.
  excludeUrlPatterns: ['/spring-2026-performances/support'],
  detail: {
    fromField: '_detailUrl',
    fingerprint: ['title'],
    template: {
      version: 2,
      nodes: [
        {
          type: 'container',
          id: 'detail',
          label: 'Detail',
          selector: 'html',
          children: [
            {
              // og:title "KE'RON J. WILSON | JUNE 11-13" -> "KE'RON J. WILSON"
              type: 'field',
              id: 'title',
              csvField: 'title',
              selector: 'meta[property="og:title"]',
              attribute: 'content',
              regex: '^\\s*([^|\\u2014—]+?)\\s*(?:[|\\u2014—]|$)',
              transform: 'trim'
            },
            {
              type: 'field',
              id: 'poster',
              csvField: 'showImageUrl',
              selector: 'meta[property="og:image"]',
              attribute: 'content',
              transform: 'trim'
            },
            {
              // Body: "JUNE 11-13, 8PM" — capture the start month+day (year-less,
              // inferred). Optional outer group so a no-match yields ''.
              type: 'field',
              id: 'date',
              csvField: 'date',
              selector: 'body',
              regex: '^(?:[\\s\\S]*?((?:JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)[A-Za-z]*\\s+\\d{1,2}))',
              transform: 'date'
            },
            {
              type: 'field',
              id: 'time',
              csvField: 'time',
              selector: 'body',
              regex: '^(?:[\\s\\S]*?(\\d{1,2}(?::\\d{2})?\\s*[AP]M))',
              transform: 'time'
            },
            {
              // Description: among the Squarespace rich-text blocks that carry a
              // large-format paragraph (p.sqsrte-large), the order is stable
              // across every show page — [0] ticket pricing, [1] the show
              // synopsis, [2] the artist bio, [3+] the site footer. So index 1 is
              // the synopsis. This survives the header blocks shifting position
              // (subtitles, extra photo credits) that break a raw nth-block index.
              type: 'field',
              id: 'description',
              csvField: 'showDescription',
              selector: '.sqs-html-content:has(p.sqsrte-large)',
              index: 1,
              transform: 'trim'
            }
          ]
        }
      ]
    }
  },
  rowDefaults: {
    venueName: 'Triskelion Arts',
    venueAddress: '106 Calyer Street',
    venueCity: 'Brooklyn',
    venueState: 'NY',
    venueZipCode: '11222',
    performanceTypes: 'dance'
  },
  maxItems: 30
}

async function main() {
  const mongoUrl = process.env.MONGODB_URL
  if (!mongoUrl) throw new Error('MONGODB_URL not set')
  await mongoose.connect(mongoUrl)

  try {
    const admin = await UserModel.findOne({ isAdmin: true })
    if (!admin) throw new Error('No admin user found')

    const existing = await DataSourceModel.findOne({ type: 'scraper', url: CONFIG.startUrl })
    if (existing) {
      existing.name = 'Triskelion Arts (triskelionarts.org)'
      existing.config = CONFIG
      existing.consecutiveFailures = 0
      existing.disabledReason = undefined
      existing.isActive = true
      await existing.save()
      console.log('Updated Triskelion Arts DataSource:', existing._id.toString())
      return
    }

    const venue = await VenueModel.findOne({ name: { $regex: /triskelion/i } })

    const ds = await DataSourceModel.create({
      name: 'Triskelion Arts (triskelionarts.org)',
      type: 'scraper',
      url: CONFIG.startUrl,
      config: CONFIG,
      associatedVenue: venue?._id,
      createdBy: admin._id,
      isActive: true,
      consecutiveFailures: 0,
      cooldownHours: 24
    })
    console.log('Created Triskelion Arts DataSource:', ds._id.toString())
    if (venue) console.log('  associated with venue:', venue._id.toString(), `(${venue.name})`)
    else console.log('  no existing Triskelion Arts venue found — scraper will create one on first run')
  } finally {
    await mongoose.disconnect()
  }
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
