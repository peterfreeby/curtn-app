import '../config/env'
import mongoose from 'mongoose'
import { DataSourceModel } from '../entities/dataSource/dataSourceModel'
import { UserModel } from '../entities/user/userModel'
import { VenueModel } from '../entities/venue/venueModel'
import type { ScraperDataSourceConfig } from '../services/scraping/types'

// Tier 2 (template + detail-follow) — Lehman Center for the Performing Arts, Bronx.
// Wix site. The homepage is a Wix Pro Gallery (.wixui-gallery__item) of poster
// tiles, each linking to a hand-built /events/<slug> page. No Event JSON-LD
// (only an ImageObject), so we detail-follow each event page and pull:
//   - title       <meta og:title> ("NAME | Lehman Center" -> strip the suffix)
//   - poster      <meta og:image>
//   - description <meta og:description> (editorial tagline; the body prose lives
//                 in per-page hashed comp-* rich-text blocks with no stable hook)
//   - date/time   regex off the body text, which always reads
//                 "WEEKDAY, MONTH D[, YYYY] at H:MMPM"
//   - ticketUrl   the Ticketmaster "GET TICKETS" button (free salsa nights only
//                 carry a PayPal donate link, so they stage without a ticketUrl)
// Detail container is <html> so the <head> meta tags resolve alongside the
// <body> text and the ticket anchor.

const CONFIG: ScraperDataSourceConfig = {
  startUrl: 'https://www.lehmancenter.org/events',
  strategy: {
    mode: 'template',
    template: {
      version: 2,
      nodes: [
        {
          // Each event is an <a href="/events/<slug>"> (poster + title anchors);
          // the gallery-item wrapper only renders the first few, so match the
          // anchors directly. Duplicate anchors per event collapse at staging
          // (title dedup). The nav "EVENTS" link is /events (no trailing slug),
          // so it doesn't match "/events/".
          type: 'container',
          id: 'events',
          label: 'Events',
          selector: 'a[href*="/events/"]',
          children: [
            {
              // Provisional title for the detail fingerprint/cache key; the
              // detail og:title overrides it on the final row.
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
            }
          ]
        }
      ]
    }
  },
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
            {
              // "GINUWINE | Lehman Center" -> "GINUWINE"
              type: 'field',
              id: 'ogTitle',
              csvField: 'title',
              selector: 'meta[property="og:title"]',
              attribute: 'content',
              regex: '^([^|]+)',
              transform: 'trim'
            },
            {
              type: 'field',
              id: 'ogImage',
              csvField: 'showImageUrl',
              selector: 'meta[property="og:image"]',
              attribute: 'content',
              transform: 'trim'
            },
            {
              type: 'field',
              id: 'ogDesc',
              csvField: 'showDescription',
              selector: 'meta[property="og:description"]',
              attribute: 'content',
              transform: 'trim'
            },
            {
              // Body text reads "SATURDAY, NOVEMBER 7, 2026 at 8:00PM" — capture
              // the month/day(/year). Year is optional; the date transform infers
              // the current year and rolls forward when it's absent.
              type: 'field',
              id: 'date',
              csvField: 'date',
              selector: 'body',
              // Optional outer group so a page with no month-date yields '' rather
              // than the no-match fallback dumping the entire <body> text.
              regex: '^(?:[\\s\\S]*?((?:JANUARY|FEBRUARY|MARCH|APRIL|MAY|JUNE|JULY|AUGUST|SEPTEMBER|OCTOBER|NOVEMBER|DECEMBER)\\s+\\d{1,2}(?:,\\s*\\d{4})?))?',
              transform: 'date'
            },
            {
              // Anchored on "at " so the event showtime is grabbed, not the
              // "10:00am - 5:00pm" box-office hours in the footer.
              type: 'field',
              id: 'time',
              csvField: 'time',
              selector: 'body',
              // Minutes are optional ("at 8PM" and "at 8:00PM" both occur); the
              // optional outer group returns '' on no match instead of dumping
              // the whole <body> text.
              regex: '^(?:[\\s\\S]*?at\\s+(\\d{1,2}(?::\\d{2})?\\s*[AP]M))?',
              transform: 'time'
            },
            {
              type: 'field',
              id: 'ticketUrl',
              csvField: 'ticketUrl',
              selector: 'a[href*="ticketmaster"]',
              attribute: 'href',
              transform: 'trim'
            }
          ]
        }
      ]
    }
  },
  rowDefaults: {
    venueName: 'Lehman Center for the Performing Arts',
    venueAddress: '250 Bedford Park Blvd West',
    venueCity: 'Bronx',
    venueState: 'NY',
    venueZipCode: '10468'
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
      existing.name = 'Lehman Center (lehmancenter.org)'
      existing.config = CONFIG
      existing.consecutiveFailures = 0
      existing.disabledReason = undefined
      existing.isActive = true
      await existing.save()
      console.log('Updated Lehman Center DataSource:', existing._id.toString())
      return
    }

    const venue = await VenueModel.findOne({ name: { $regex: /lehman center/i } })

    const ds = await DataSourceModel.create({
      name: 'Lehman Center (lehmancenter.org)',
      type: 'scraper',
      url: CONFIG.startUrl,
      config: CONFIG,
      associatedVenue: venue?._id,
      createdBy: admin._id,
      isActive: true,
      consecutiveFailures: 0,
      cooldownHours: 24
    })
    console.log('Created Lehman Center DataSource:', ds._id.toString())
    if (venue) console.log('  associated with venue:', venue._id.toString(), `(${venue.name})`)
    else console.log('  no existing Lehman Center venue found — scraper will create one on first run')
  } finally {
    await mongoose.disconnect()
  }
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
