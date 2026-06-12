import '../config/env'
import mongoose from 'mongoose'
import { DataSourceModel } from '../entities/dataSource/dataSourceModel'
import { UserModel } from '../entities/user/userModel'
import { VenueModel } from '../entities/venue/venueModel'
import type { ScraperDataSourceConfig } from '../services/scraping/types'

// Los Angeles Theatre Center (thelatc.org) — Latino Theater Company. Squarespace,
// no JSON-LD, and the season data is editorially fragmented: the /2026season
// "List Section" carries the clean run-date RANGE ("March 26 - May 3, 2026") +
// the per-show detail link, but the show NAME is baked into the poster image
// (the title text slot holds the dates, image alt is empty). The clean title,
// synopsis, poster and ticket link all live on each /<slug> detail page's OG tags.
//
// So: list section provides run dates + detail URL (and a date placeholder title,
// required before detail-fetch runs); the detail fetch overrides title with
// og:title (venue suffix stripped via cleanup), and pulls og:description, og:image
// and the show-specific AudienceView ticket link (EventAvailability?EventId=).

const CONFIG: ScraperDataSourceConfig = {
  startUrl: 'https://thelatc.org/2026season',
  strategy: {
    mode: 'template',
    template: {
      version: 2,
      nodes: [
        {
          type: 'container',
          id: 'shows',
          label: 'Season',
          selector: '.list-item-content',
          children: [
            // The list editor put the run range in the title slot. Use it as a
            // placeholder title (passes the non-empty check) — the detail fetch
            // overrides it with the real og:title.
            { type: 'field', id: 'title', csvField: 'title', selector: '.list-item-content__title', transform: 'trim' },
            {
              type: 'field',
              id: 'runStartDate',
              csvField: 'runStartDate',
              selector: '.list-item-content__title',
              transform: 'date-range-start'
            },
            {
              type: 'field',
              id: 'runEndDate',
              csvField: 'runEndDate',
              selector: '.list-item-content__title',
              transform: 'date-range-end'
            },
            {
              type: 'field',
              id: 'detailUrl',
              csvField: '_detailUrl',
              selector: '.list-item-content__button',
              attribute: 'href',
              transform: 'trim'
            }
          ]
        }
      ]
    }
  },
  rowDefaults: {
    venueName: 'Los Angeles Theatre Center',
    venueAddress: '514 S Spring St',
    venueCity: 'Los Angeles',
    venueState: 'CA',
    venueZipCode: '90013',
    performanceTypes: 'theater'
  },
  maxItems: 30,
  cleanup: {
    // og:title is "<Show> — Latino Theater Co. at The LATC"; strip the suffix.
    titleStripPatterns: ['\\s*[–—-]\\s*Latino Theater Co\\.? at The LATC\\s*$']
  },
  detail: {
    fromField: '_detailUrl',
    fingerprint: ['runStartDate'],
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
            {
              type: 'field',
              id: 'ticketUrl',
              csvField: 'ticketUrl',
              selector: 'a[href*="EventAvailability"]',
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
      console.log('Updated existing LATC DataSource:', existing._id.toString())
      return
    }

    const venue = await VenueModel.findOne({ name: { $regex: /los angeles theatre center/i } })
    const ds = await DataSourceModel.create({
      name: 'Los Angeles Theatre Center (thelatc.org)',
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
    console.log('Created LATC DataSource:', ds._id.toString())
    if (venue) console.log('  associated with venue:', venue._id.toString(), `(${venue.name})`)
    else console.log('  no existing LATC venue found — scraper will create one on first run')
  } finally {
    await mongoose.disconnect()
  }
}

main().catch(err => { console.error(err); process.exit(1) })
