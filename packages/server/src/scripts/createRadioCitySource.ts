import '../config/env'
import mongoose from 'mongoose'
import { DataSourceModel } from '../entities/dataSource/dataSourceModel'
import { UserModel } from '../entities/user/userModel'
import { VenueModel } from '../entities/venue/venueModel'
import type { ScraperDataSourceConfig } from '../services/scraping/types'

// One-shot script: create a DataSource doc for Radio City Music Hall (msg.com).
//
// The MSG platform renders each venue page as Next.js with CSS-module class
// names (VenueEventList_venue-event-item__<hash>). The trailing hash rotates
// per build, so every selector uses [class*="..."] substring matches against
// the stable component/class prefix — never the full hashed token.
//
// Listing page: no JSON-LD, but a venue-scoped VenueEventList block holds one
// item per performance (title, "Thu, Jul 23, 2026 - 7:30 PM ET" datetime,
// poster, a Ticketmaster buy link, and the detail-page URL). The cross-venue
// "Card" carousel above it (Beacon / MSG arena promos) is deliberately NOT
// matched — only VenueEventList items are Radio City's own.
//
// Detail page: the full marketing description lives in the first (open)
// Accordion content block; the JSON-LD Event on the page carries only a
// generic "Get tickets to see..." blurb, so we pull the real copy from the DOM
// via a detail template instead. freshContextPerFetch guards against MSG's
// anti-bot session degradation across sequential detail fetches.

const RADIO_CITY_CONFIG: ScraperDataSourceConfig = {
  startUrl: 'https://www.msg.com/radio-city-music-hall',
  strategy: {
    mode: 'template',
    template: {
      version: 2,
      nodes: [
        {
          type: 'container',
          id: 'events',
          label: 'Events',
          // Venue-scoped list items. Excludes the cross-venue Card carousel.
          selector: '[class*="VenueEventList_venue-event-item"]',
          children: [
            {
              type: 'field',
              id: 'title',
              csvField: 'title',
              selector: '[class*="VenueEventList_event-name"]',
              transform: 'trim'
            },
            {
              // "Thu, Jul 23, 2026 - 7:30 PM ET" → capture the date portion.
              type: 'field',
              id: 'date',
              csvField: 'date',
              selector: '[class*="VenueEventList_event-datetime"]',
              regex: '([A-Za-z]+ \\d{1,2}, \\d{4})',
              transform: 'date'
            },
            {
              // Same node → capture the clock time. Avoids the JSON-LD UTC
              // startDate (which the extractor formats in server-local time).
              type: 'field',
              id: 'time',
              csvField: 'time',
              selector: '[class*="VenueEventList_event-datetime"]',
              regex: '(\\d{1,2}:\\d{2}\\s*[AP]M)',
              transform: 'time'
            },
            {
              // Ticketmaster buy link. ticketUrl auto-falls-back to the detail
              // URL then the listing URL if this ever misses.
              type: 'field',
              id: 'ticketUrl',
              csvField: 'ticketUrl',
              selector: 'a[href*="ticketmaster"]',
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
              // Detail page link (relative /events-tickets/...). Captured into
              // the magic field the orchestrator follows; stripped pre-staging.
              type: 'field',
              id: 'detailUrl',
              csvField: '_detailUrl',
              selector: 'a[aria-label^="View details"]',
              attribute: 'href',
              transform: 'trim'
            }
          ]
        }
      ]
    }
  },
  rowDefaults: {
    venueName: 'Radio City Music Hall',
    venueAddress: '1260 Avenue of the Americas',
    venueCity: 'New York',
    venueState: 'NY',
    venueZipCode: '10020',
    // Current engagement is LES MISÉRABLES: THE ARENA CONCERT SPECTACULAR — a
    // musical. Applied as the row default (MSG detail JSON-LD types Radio City
    // shows as generic "Event", so no type is inferable from the page).
    performanceTypes: 'musical'
  },
  maxItems: 50,
  // The show's "About" accordion runs the narrative straight into the "Starring"
  // cast list and a "Group Tickets" promo block. We capture the cast as
  // structured credits below, so strip everything from "Starring" onward off
  // the description (leaves the clean marketing narrative).
  cleanup: {
    descriptionStripPatterns: ['Starring[\\s\\S]*$']
  },
  detail: {
    fromField: '_detailUrl',
    fingerprint: ['title', 'date'],
    // Guard against MSG anti-bot / hydration across sequential fetches.
    freshContextPerFetch: true,
    waitForSelector: '[class*="Accordion_content"]',
    template: {
      version: 2,
      nodes: [
        {
          type: 'container',
          id: 'detail',
          label: 'Event detail',
          selector: 'body',
          children: [
            {
              // The first Accordion content block is the show's "About" copy
              // (open by default). Later accordions hold venue logistics/FAQ.
              type: 'field',
              id: 'fullDescription',
              csvField: 'showDescription',
              selector: '[class*="Accordion_content"]',
              transform: 'trim'
            },
            {
              // Cast list: each principal is "<strong>NAME</strong> as ROLE" in
              // its own <p> inside the About copy. Fan out one row per member;
              // staging rolls personName/personRole into the show's cast array.
              // (Cast is date-specific — each performance's detail page lists
              // its own principals — so this varies per staged performance.)
              type: 'container',
              id: 'cast',
              label: 'Cast',
              // Scope to the FIRST accordion (the About copy). The page has ~10
              // accordions; later ones (Group Tickets, Cardholders, SkyMiles)
              // also use <p><strong>, so match only the show's own cast list.
              selector: '[class*="Accordion_content"]:eq(0) p:has(strong)',
              children: [
                {
                  type: 'field',
                  id: 'personName',
                  csvField: 'personName',
                  selector: 'strong',
                  transform: 'trim'
                },
                {
                  type: 'field',
                  id: 'personRole',
                  csvField: 'personRole',
                  selector: ':scope',
                  regex: ' as (.+)$',
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

    const existing = await DataSourceModel.findOne({
      type: 'scraper',
      url: RADIO_CITY_CONFIG.startUrl
    })
    if (existing) {
      existing.config = RADIO_CITY_CONFIG
      existing.consecutiveFailures = 0
      existing.disabledReason = undefined
      existing.isActive = true
      await existing.save()
      console.log('Updated existing Radio City DataSource:', existing._id.toString())
      return
    }

    const venue = await VenueModel.findOne({
      name: { $regex: /^radio city music hall$/i }
    })

    const ds = await DataSourceModel.create({
      name: 'Radio City Music Hall (msg.com)',
      type: 'scraper',
      url: RADIO_CITY_CONFIG.startUrl,
      config: RADIO_CITY_CONFIG,
      associatedVenue: venue?._id,
      createdBy: admin._id,
      isActive: true,
      consecutiveFailures: 0,
      cooldownHours: 24
    })
    console.log('Created Radio City DataSource:', ds._id.toString())
    if (venue) console.log('  associated with venue:', venue._id.toString(), `(${venue.name})`)
    else console.log('  no existing Radio City venue found — scraper will create one on first run')
  } finally {
    await mongoose.disconnect()
  }
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
