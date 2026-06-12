import '../config/env'
import mongoose from 'mongoose'
import { DataSourceModel } from '../entities/dataSource/dataSourceModel'
import { UserModel } from '../entities/user/userModel'
import { VenueModel } from '../entities/venue/venueModel'
import type { OgFallbackConfig } from '../services/ogFetch'

// History Theatre (historytheatre.com) — rung 4 OG-fallback, not a scraper.
// The Drupal site has no JSON-LD/og in the rendered DOM we can cleanly target
// (descriptions are interleaved with promo blurbs, dates are classless, posters
// mix with cast-headshot collages). But FB's crawler reads the page's OG tags
// fine — title, a credits+synopsis description, and the real poster. So we
// harvest the season-page show links and fetch each via the FB Graph API.
//
// Show URLs are /YYYY-YYYY/<slug> (e.g. /2025-2026/whoosh); the season page
// also links next season (/2026-2027/<slug>). linkRegex catches both and skips
// the /YYYY-YY-season landing pages.

const SOURCE_URL = 'https://www.historytheatre.com/2025-26-season'

const CONFIG: OgFallbackConfig = {
  kind: 'og-fallback',
  venueName: 'History Theatre',
  // Street omitted (not reliably extractable) — Saint Paul, MN; enrich later.
  venueCity: 'Saint Paul',
  venueState: 'MN',
  performanceTypes: 'theater',
  titleSuffixes: [' | History Theatre'],
  // FB auto-generates the og:description (no real one on the page) by dumping
  // page text: "{title} {credits} {date-range} [{filename}.jpg | Buy Tickets
  // Book a Group] {synopsis}". The synopsis always follows the date range, so
  // strip through it first, then mop up any filename/CTA that sits between the
  // dates and the synopsis. Applied in sequence.
  descriptionStripPatterns: [
    '^.*?[\\u2013\\u2014-]\\s*[A-Z][a-z]+\\.?\\s+\\d{1,2},?\\s*\\d{4}\\s*', // through "–Month D, YYYY"
    '^.*?\\.(?:jpe?g|png|webp)\\s*',                                        // leading image filename
    '^.*?Book a Group\\s*'                                                  // CTA buttons
  ],
  discovery: {
    url: SOURCE_URL,
    linkRegex: '/20\\d\\d-20\\d\\d/[^/?#]+$'
  }
}

async function main() {
  const mongoUrl = process.env.MONGODB_URL
  if (!mongoUrl) throw new Error('MONGODB_URL not set')
  await mongoose.connect(mongoUrl)
  try {
    const admin = await UserModel.findOne({ isAdmin: true })
    if (!admin) throw new Error('No admin user found — run setAdmin first')

    const existing = await DataSourceModel.findOne({ type: 'api', url: SOURCE_URL })
    if (existing) {
      existing.config = CONFIG as unknown as Record<string, any>
      existing.consecutiveFailures = 0
      existing.disabledReason = undefined
      existing.isActive = true
      await existing.save()
      console.log('Updated History Theatre OG source:', existing._id.toString())
      return
    }
    const venue = await VenueModel.findOne({ name: { $regex: /^history theatre$/i } })
    const ds = await DataSourceModel.create({
      name: 'History Theatre (OG fallback)',
      type: 'api',
      url: SOURCE_URL,
      config: CONFIG as unknown as Record<string, any>,
      associatedVenue: venue?._id,
      createdBy: admin._id,
      isActive: true,
      consecutiveFailures: 0,
      cooldownHours: 24
    })
    console.log('Created History Theatre OG source:', ds._id.toString())
  } finally {
    await mongoose.disconnect()
  }
}

main().catch(err => { console.error(err); process.exit(1) })
