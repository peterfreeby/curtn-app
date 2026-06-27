import '../config/env'
import mongoose from 'mongoose'
import { DataSourceModel } from '../entities/dataSource/dataSourceModel'
import { UserModel } from '../entities/user/userModel'
import { VenueModel } from '../entities/venue/venueModel'
import type { ScraperDataSourceConfig } from '../services/scraping/types'

// Tier 2 (template) — Flappers Comedy Club, Burbank LA.
// Homepage lists ~46 upcoming shows in stable .upcoming-event cards (no
// JSON-LD). Each card carries title, a combined "Sat Jun 27th 7:30pm" line,
// the room, a thumbnail, and a link to /site/shows.php?event_id=… (ticket page).
//
// Descriptions: the detail/ticket page (/site/shows.php?event_id=…) carries a
// real per-show blurb in #showDesc[data-full] for named/headliner shows (e.g.
// Jeff Garlin, Francisco Ramos), while recurring/generic shows legitimately
// expose only the placeholder "Appearing at Flappers". We follow the detail
// page to pull the real ones. NOTE: the detail page is Cloudflare-fronted and
// JS-hydrates #showDesc after load — reliable capture needs the detail fetch to
// wait for #showDesc to populate (waitForSelector) and avoid same-page rate
// limiting. See la-outcomes for the core detail-fetch improvement this depends
// on. Placeholder descriptions are stripped via cleanup below.
//
// Selectors are Flappers' own semantic classes (.upcoming-event, .upcoming-info,
// .upcoming-thumbnail) — no CSS-in-JS hashes here, so they're deploy-stable.

const CONFIG: ScraperDataSourceConfig = {
  startUrl: 'https://flapperscomedy.com/',
  strategy: {
    mode: 'template',
    template: {
      version: 2,
      nodes: [
        {
          type: 'container',
          id: 'events',
          label: 'Events',
          selector: '.upcoming-event',
          children: [
            {
              type: 'field',
              id: 'title',
              csvField: 'title',
              selector: '.upcoming-info h3',
              transform: 'trim'
            },
            {
              type: 'field',
              id: 'ticketUrl',
              csvField: 'ticketUrl',
              selector: '.upcoming-info h3 a',
              attribute: 'href',
              transform: 'trim'
            },
            {
              // First <p> in .upcoming-info is "Sat Jun 27th 7:30pm". Strip the
              // ordinal ("th") by capturing only "Sat Jun 27" so new Date()
              // can parse it; the engine infers the year.
              type: 'field',
              id: 'date',
              csvField: 'date',
              selector: '.upcoming-info p',
              regex: '([A-Za-z]{3}\\s+[A-Za-z]{3}\\s+\\d{1,2})',
              transform: 'date'
            },
            {
              type: 'field',
              id: 'time',
              csvField: 'time',
              selector: '.upcoming-info p',
              regex: '(\\d{1,2}:\\d{2}\\s*[APap][Mm])',
              transform: 'time'
            },
            {
              // Second <p> is the room, e.g. "Flappers Comedy Club Burbank- Yoo
              // Hoo Room". Capture the room name after the last dash.
              type: 'field',
              id: 'stage',
              csvField: 'stageName',
              selector: '.upcoming-info p',
              index: 1,
              regex: '-\\s*([^-]+?Room)\\s*$',
              transform: 'trim'
            },
            {
              type: 'field',
              id: 'poster',
              csvField: 'showImageUrl',
              selector: 'img.upcoming-thumbnail',
              attribute: 'src',
              transform: 'trim'
            },
            {
              // Detail/ticket page — followed for the real show description.
              type: 'field',
              id: 'detailUrl',
              csvField: '_detailUrl',
              selector: '.upcoming-info h3 a',
              attribute: 'href',
              transform: 'trim'
            }
          ]
        }
      ]
    }
  },
  rowDefaults: {
    venueName: 'Flappers Comedy Club',
    venueAddress: '102 E. Magnolia Blvd',
    venueCity: 'Burbank',
    venueState: 'CA',
    venueZipCode: '91502',
    performanceTypes: 'comedy'
  },
  maxItems: 60,
  detail: {
    fromField: '_detailUrl',
    fingerprint: ['title', 'date'],
    // The detail page JS-hydrates #showDesc after load and is Cloudflare-fronted.
    // Wait until #showDesc is populated (not just present), and use a fresh
    // browser context per fetch to avoid reuse/anti-bot degradation across rows.
    waitForSelector: '#showDesc',
    freshContextPerFetch: true,
    template: {
      version: 2,
      nodes: [
        {
          type: 'container',
          id: 'detail',
          label: 'Event detail',
          selector: '.middle-box',
          children: [
            {
              // Full show blurb (un-truncated) in #showDesc[data-full].
              type: 'field',
              id: 'fullDescription',
              csvField: 'showDescription',
              selector: '#showDesc',
              attribute: 'data-full',
              transform: 'trim'
            }
          ]
        }
      ]
    }
  },
  // Drop the boilerplate placeholder so generic shows surface as no-description
  // rather than a fake blurb.
  cleanup: {
    descriptionStripPatterns: ['^Appearing at Flappers$']
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
      existing.name = 'Flappers Comedy Club (flapperscomedy.com)'
      existing.config = CONFIG as unknown as Record<string, any>
      existing.consecutiveFailures = 0
      existing.disabledReason = undefined
      existing.isActive = true
      await existing.save()
      console.log('Updated Flappers DataSource:', existing._id.toString())
      return
    }

    const venue = await VenueModel.findOne({ name: { $regex: /flappers/i } })

    const ds = await DataSourceModel.create({
      name: 'Flappers Comedy Club (flapperscomedy.com)',
      type: 'scraper',
      url: CONFIG.startUrl,
      config: CONFIG as unknown as Record<string, any>,
      associatedVenue: venue?._id,
      createdBy: admin._id,
      isActive: true,
      consecutiveFailures: 0,
      cooldownHours: 24
    })
    console.log('Created Flappers DataSource:', ds._id.toString())
    if (venue) console.log('  associated with venue:', venue._id.toString(), `(${venue.name})`)
  } finally {
    await mongoose.disconnect()
  }
}

main().catch(err => { console.error(err); process.exit(1) })
