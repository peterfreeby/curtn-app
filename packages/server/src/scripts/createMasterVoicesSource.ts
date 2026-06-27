import '../config/env'
import mongoose from 'mongoose'
import { DataSourceModel } from '../entities/dataSource/dataSourceModel'
import { UserModel } from '../entities/user/userModel'
import { VenueModel } from '../entities/venue/venueModel'
import type { ScraperDataSourceConfig } from '../services/scraping/types'

// MasterVoices (mastervoices.org) — NYC choral/opera company (Carnegie Hall etc.).
// WordPress, two-level scrape, no Event JSON-LD.
//
// MasterVoices is a touring company: each production plays a DIFFERENT NYC hall
// (Carnegie Hall, Radio City Music Hall, David Geffen Hall, Perelman PAC), so
// the venue is extracted per-show on the detail page rather than fixed in
// rowDefaults — only city/state (always NYC) are defaulted.
//
// Listing: the homepage's upcoming season is a set of
//   <article class="event-square"><a class="block-link" href="/events/<slug>/">…<h4>TITLE</h4></article>
// cards. We capture the title (placeholder) + detail URL.
//
// Detail: each /events/<slug>/ page is clean and stable. og:title is the show
// name (strip " - MasterVoices"), og:description the synopsis, og:image the
// poster. The performance date (with year) is `strong.highlight.uppercase`
// ("December 15, 2026"), the hall is `span.uppercase` ("Carnegie Hall …"), and
// the primary "Purchase Tickets" CTA is `a.button-invert` (absent until a show's
// tickets go on sale).

const CONFIG: ScraperDataSourceConfig = {
  startUrl: 'https://www.mastervoices.org/',
  strategy: {
    mode: 'template',
    template: {
      version: 2,
      nodes: [
        {
          type: 'container',
          id: 'shows',
          label: 'Upcoming',
          selector: 'article.event-square',
          children: [
            { type: 'field', id: 'title', csvField: 'title', selector: 'h4', transform: 'trim' },
            {
              type: 'field',
              id: 'detailUrl',
              csvField: '_detailUrl',
              selector: 'a.block-link',
              attribute: 'href',
              transform: 'trim'
            }
          ]
        }
      ]
    }
  },
  rowDefaults: {
    // venueName is extracted per-show (touring company); only the city/state are
    // constant. performanceTypes 'opera' per the company's choral/opera focus.
    venueCity: 'New York',
    venueState: 'NY',
    performanceTypes: 'opera'
  },
  maxItems: 30,
  cleanup: {
    // og:title is "<Show> - MasterVoices"; strip the suffix.
    titleStripPatterns: ['\\s*[–—-]\\s*MasterVoices\\s*$']
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
          label: 'Show detail',
          selector: 'html',
          children: [
            { type: 'field', id: 'title', csvField: 'title', selector: 'meta[property="og:title"]', attribute: 'content', transform: 'trim' },
            { type: 'field', id: 'desc', csvField: 'showDescription', selector: 'meta[property="og:description"]', attribute: 'content', transform: 'trim' },
            { type: 'field', id: 'poster', csvField: 'showImageUrl', selector: 'meta[property="og:image"]', attribute: 'content', transform: 'trim' },
            { type: 'field', id: 'venue', csvField: 'venueName', selector: 'span.uppercase', transform: 'trim' },
            { type: 'field', id: 'date', csvField: 'date', selector: 'strong.highlight.uppercase', transform: 'date-range-start' },
            { type: 'field', id: 'runStart', csvField: 'runStartDate', selector: 'strong.highlight.uppercase', transform: 'date-range-start' },
            { type: 'field', id: 'runEnd', csvField: 'runEndDate', selector: 'strong.highlight.uppercase', transform: 'date-range-end' },
            {
              type: 'field',
              id: 'ticketUrl',
              csvField: 'ticketUrl',
              selector: 'a.button-invert',
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
      console.log('Updated existing MasterVoices DataSource:', existing._id.toString())
      return
    }

    const venue = await VenueModel.findOne({ name: { $regex: /master\s*voices/i } })
    const ds = await DataSourceModel.create({
      name: 'MasterVoices (mastervoices.org)',
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
    console.log('Created MasterVoices DataSource:', ds._id.toString())
    if (venue) console.log('  associated with venue:', venue._id.toString(), `(${venue.name})`)
    else console.log('  no existing MasterVoices venue found — scraper will create one on first run')
  } finally {
    await mongoose.disconnect()
  }
}

main().catch(err => { console.error(err); process.exit(1) })
