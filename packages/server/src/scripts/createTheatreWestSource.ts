import '../config/env'
import mongoose from 'mongoose'
import { DataSourceModel } from '../entities/dataSource/dataSourceModel'
import { UserModel } from '../entities/user/userModel'
import { VenueModel } from '../entities/venue/venueModel'
import type { ScraperDataSourceConfig } from '../services/scraping/types'

// Tier 2 (template) — Theatre West, Cahuenga Blvd (oldest continuously-running
// theater company in LA). Homepage lists current productions in stable .card
// blocks (no JSON-LD). Each card carries the show title (h5 > em), a subtitle
// + a run-date line (the 2nd h6.title, e.g. "May 29–June 28, 2026"), a poster,
// an Eventbrite "Get Tickets" link, and a /on-stage/<slug> detail link. We
// follow the detail page (standard WordPress, no JS/Cloudflare) for the full
// synopsis + credits.
//
// Selectors are Theatre West's own semantic classes (.card, h5, h6.title) — no
// CSS-in-JS hashes — so they're deploy-stable. The date line is consistently
// the SECOND h6.title across cards (index 1); the first is the series subtitle.

const CONFIG: ScraperDataSourceConfig = {
  startUrl: 'https://theatrewest.org/',
  strategy: {
    mode: 'template',
    template: {
      version: 2,
      nodes: [
        {
          type: 'container',
          id: 'events',
          label: 'Productions',
          selector: '.card',
          children: [
            {
              type: 'field',
              id: 'title',
              csvField: 'title',
              selector: 'h5',
              transform: 'trim'
            },
            {
              // Run-date line is the 2nd h6.title (index 1); the 1st is the
              // series subtitle. Single dates ("June 13, 2026") parse fine too.
              type: 'field',
              id: 'date',
              csvField: 'date',
              selector: 'h6.title',
              index: 1,
              transform: 'date-range-start'
            },
            {
              type: 'field',
              id: 'runStart',
              csvField: 'runStartDate',
              selector: 'h6.title',
              index: 1,
              transform: 'date-range-start'
            },
            {
              type: 'field',
              id: 'runEnd',
              csvField: 'runEndDate',
              selector: 'h6.title',
              index: 1,
              transform: 'date-range-end'
            },
            {
              // Eventbrite ticket link (the card's other links are self /on-stage
              // links, sometimes absolute — match eventbrite explicitly).
              type: 'field',
              id: 'ticketUrl',
              csvField: 'ticketUrl',
              selector: 'a[href*="eventbrite"]',
              attribute: 'href',
              transform: 'trim'
            },
            {
              type: 'field',
              id: 'poster',
              csvField: 'showImageUrl',
              selector: 'img',
              attribute: 'src',
              transform: 'trim'
            },
            {
              type: 'field',
              id: 'detailUrl',
              csvField: '_detailUrl',
              selector: 'a[href*="/on-stage/"]',
              attribute: 'href',
              transform: 'trim'
            }
          ]
        }
      ]
    }
  },
  rowDefaults: {
    venueName: 'Theatre West',
    venueAddress: '3333 Cahuenga Blvd West',
    venueCity: 'Los Angeles',
    venueState: 'CA',
    venueZipCode: '90068',
    performanceTypes: 'theater'
  },
  maxItems: 30,
  detail: {
    fromField: '_detailUrl',
    fingerprint: ['title', 'date'],
    template: {
      version: 2,
      nodes: [
        {
          // Joomla com_content page: the synopsis lives in the article body's
          // leading <p>s (the 19 <article class="bio-card"> are cast/crew bios).
          // In DOM order the article-body paragraphs come first: presenter line
          // (p0), synopsis/logline (p1), credits (p2); bio paragraphs follow. So
          // descendant `p` index 1 is the synopsis logline. Single top-level
          // field → one row per page.
          type: 'field',
          id: 'fullDescription',
          csvField: 'showDescription',
          selector: '[itemprop="articleBody"] p',
          index: 1,
          transform: 'trim'
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
    if (!admin) throw new Error('No admin user found')

    const existing = await DataSourceModel.findOne({ type: 'scraper', url: CONFIG.startUrl })
    if (existing) {
      existing.name = 'Theatre West (theatrewest.org)'
      existing.config = CONFIG as unknown as Record<string, any>
      existing.consecutiveFailures = 0
      existing.disabledReason = undefined
      existing.isActive = true
      await existing.save()
      console.log('Updated Theatre West DataSource:', existing._id.toString())
      return
    }

    const venue = await VenueModel.findOne({ name: { $regex: /theatre west/i } })

    const ds = await DataSourceModel.create({
      name: 'Theatre West (theatrewest.org)',
      type: 'scraper',
      url: CONFIG.startUrl,
      config: CONFIG as unknown as Record<string, any>,
      associatedVenue: venue?._id,
      createdBy: admin._id,
      isActive: true,
      consecutiveFailures: 0,
      cooldownHours: 24
    })
    console.log('Created Theatre West DataSource:', ds._id.toString())
    if (venue) console.log('  associated with venue:', venue._id.toString(), `(${venue.name})`)
  } finally {
    await mongoose.disconnect()
  }
}

main().catch(err => { console.error(err); process.exit(1) })
