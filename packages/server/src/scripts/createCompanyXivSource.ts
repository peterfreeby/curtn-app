import '../config/env'
import mongoose from 'mongoose'
import { DataSourceModel } from '../entities/dataSource/dataSourceModel'
import { UserModel } from '../entities/user/userModel'
import { VenueModel } from '../entities/venue/venueModel'
import type { ScraperDataSourceConfig } from '../services/scraping/types'

// Company XIV (companyxiv.com) — Baroque Burlesque repertory house at Théâtre XIV
// in Bushwick, Brooklyn. No JSON-LD anywhere; the /tickets/ box office is a
// JS-gated seating widget that exposes NO per-showtime dates server-side (does
// not even populate headless), so this venue is scraped at the PRODUCTION/RUN
// level: one rich row per show. That is the natural Curtn unit for a repertory
// cabaret — each production runs for weeks/months in rep.
//
// Listing: /about/shows/ renders 6 productions as `article.gutenbee-post-types-item`
// (Gutenberg "post types" block — stable, non-CSS-in-JS classes). We capture the
// title + the show-page URL, then detail-fetch each show page for the full
// synopsis (first `p.wp-block-paragraph`) and the show-specific og:image poster.
//
// Closed / stub productions are excluded by slug: Seven Sins (closed, no clean
// synopsis) and Cinderella (one-sentence archive stub). Keeps the four rich,
// currently-programmed shows: Nutcracker Rouge, Petite Rouge, Cocktail Magique,
// Queen of Hearts — each with a full synopsis + poster + type.
//
// No per-show cast/credits are published anywhere on the site (ensemble house),
// so cast is legitimately absent, not missing.

const CONFIG: ScraperDataSourceConfig = {
  startUrl: 'https://companyxiv.com/about/shows/',
  strategy: {
    mode: 'template',
    template: {
      version: 2,
      nodes: [
        {
          type: 'container',
          id: 'shows',
          label: 'Shows',
          selector: 'article.gutenbee-post-types-item',
          children: [
            {
              type: 'field',
              id: 'title',
              csvField: 'title',
              selector: '.gutenbee-post-types-item-title',
              transform: 'trim'
            },
            {
              // Poster thumbnail's anchor → the show's own page. Used both as the
              // ticket/landing URL and as the detail-fetch source. All explicit
              // "Buy Tickets"/"Get Showtimes" buttons funnel to the JS /tickets/
              // widget, so the show page is the more useful per-show landing.
              type: 'field',
              id: 'ticketUrl',
              csvField: 'ticketUrl',
              selector: '.gutenbee-post-types-item-thumb a',
              attribute: 'href',
              transform: 'trim'
            },
            {
              type: 'field',
              id: 'detailUrl',
              csvField: '_detailUrl',
              selector: '.gutenbee-post-types-item-thumb a',
              attribute: 'href',
              transform: 'trim'
            }
          ]
        }
      ]
    }
  },
  rowDefaults: {
    venueName: 'Théâtre XIV',
    venueAddress: '383 Troutman St',
    venueCity: 'Brooklyn',
    venueState: 'NY',
    venueZipCode: '11237',
    companyName: 'Company XIV',
    performanceTypes: 'burlesque'
  },
  // Closed show (no clean synopsis) + one-sentence archive stub.
  excludeUrlPatterns: ['/seven-sins/', '/cinderella/'],
  maxItems: 20,
  detail: {
    fromField: '_detailUrl',
    fingerprint: ['title'],
    template: {
      version: 2,
      nodes: [
        {
          // 'html' container so children reach both the <head> og:image meta and
          // the <body> synopsis paragraph (same pattern as Club Cumming).
          type: 'container',
          id: 'detail',
          label: 'Show detail',
          selector: 'html',
          children: [
            {
              // First real Gutenberg paragraph on the show page is the synopsis.
              // (Critics' pull-quotes sit in heading blocks, not paragraphs.)
              type: 'field',
              id: 'fullDescription',
              csvField: 'showDescription',
              selector: 'p.wp-block-paragraph',
              transform: 'trim'
            },
            {
              // Show-specific poster (each active production sets its own og:image).
              type: 'field',
              id: 'poster',
              csvField: 'showImageUrl',
              selector: 'meta[property="og:image"]',
              attribute: 'content',
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

    const existing = await DataSourceModel.findOne({
      type: 'scraper',
      url: CONFIG.startUrl
    })
    if (existing) {
      existing.config = CONFIG
      existing.consecutiveFailures = 0
      existing.disabledReason = undefined
      existing.isActive = true
      await existing.save()
      console.log('Updated existing Company XIV DataSource:', existing._id.toString())
      return
    }

    const venue = await VenueModel.findOne({
      name: { $regex: /^(th[eé]âtre xiv|company xiv)$/i }
    })

    const ds = await DataSourceModel.create({
      name: 'Company XIV (companyxiv.com)',
      type: 'scraper',
      url: CONFIG.startUrl,
      config: CONFIG,
      associatedVenue: venue?._id,
      createdBy: admin._id,
      isActive: true,
      consecutiveFailures: 0,
      cooldownHours: 24
    })
    console.log('Created Company XIV DataSource:', ds._id.toString())
    if (venue) console.log('  associated with venue:', venue._id.toString(), `(${venue.name})`)
    else console.log('  no existing venue found — scraper will create one on first run')
  } finally {
    await mongoose.disconnect()
  }
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
