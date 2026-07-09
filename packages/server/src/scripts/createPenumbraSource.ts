import '../config/env'
import mongoose from 'mongoose'
import { DataSourceModel } from '../entities/dataSource/dataSourceModel'
import { UserModel } from '../entities/user/userModel'
import { VenueModel } from '../entities/venue/venueModel'
import type { ScraperDataSourceConfig } from '../services/scraping/types'

// Penumbra Theatre — St. Paul; the nation's flagship Black theater. The site
// MIGRATED to penumbracenter.org and restructured: the old per-performance
// article list (`.day`/`.time`/`.details h3 a`) is gone and the previous
// selectors extract 0 rows. The listing (still reachable at
// penumbratheatre.org/events, which serves the new markup) now renders ONE
// article per show:
//   <article class="category-...">
//     <a href="https://penumbracenter.org/event/<slug>/" class="responsiveImage-…">
//       <div class="details"><div class="category …">Arts</div>
//         <div class="text"><h2>TITLE</h2><div class="date">September 8 - October 4</div></div>
//   </article>
// So the listing yields title + detail URL + a yearless run-date range; the
// listing poster is a CSS background set in a <style> block (not inline), so we
// take the poster from the detail page instead.
//
// Detail pages (penumbracenter.org/event/<slug>/) carry a rich og:description
// (WRITTEN BY / DIRECTED BY + synopsis), a full-size og:image, and a `.tickets`
// block listing every performance ("Tuesday, September 8, 2026 | 7:30PM …") — we
// regex the first dated showtime out of it for a precise date + time (the listing
// range only gives yearless run dates). One row per show; fingerprint [title].

const CONFIG: ScraperDataSourceConfig = {
  startUrl: 'https://penumbratheatre.org/events',
  strategy: {
    mode: 'template',
    template: {
      version: 2,
      nodes: [
        {
          type: 'container',
          id: 'events',
          label: 'Events',
          selector: '.events article',
          children: [
            { type: 'field', id: 'title', csvField: 'title', selector: '.text h2', transform: 'trim' },
            // Yearless run-date range "September 8 - October 4". Fallback date =
            // range start (detail overrides with the precise dated showtime).
            { type: 'field', id: 'date', csvField: 'date', selector: '.date', regex: '^\\s*([A-Z][a-z]+\\s+\\d{1,2})', transform: 'date' },
            { type: 'field', id: 'runStart', csvField: 'runStartDate', selector: '.date', regex: '^\\s*([A-Z][a-z]+\\s+\\d{1,2})', transform: 'date' },
            { type: 'field', id: 'runEnd', csvField: 'runEndDate', selector: '.date', regex: '[-–]\\s*([A-Z][a-z]+\\s+\\d{1,2})', transform: 'date' },
            { type: 'field', id: 'ticketUrl', csvField: 'ticketUrl', selector: 'a[href*="/event/"]', attribute: 'href', transform: 'trim' },
            { type: 'field', id: 'detailUrl', csvField: '_detailUrl', selector: 'a[href*="/event/"]', attribute: 'href', transform: 'trim' }
          ]
        }
      ]
    }
  },
  rowDefaults: {
    venueName: 'Penumbra Theatre',
    venueAddress: '270 N Kent St',
    venueCity: 'Saint Paul',
    venueState: 'MN',
    venueZipCode: '55102',
    performanceTypes: 'theater'
  },
  maxItems: 60,
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
              type: 'field',
              id: 'poster',
              csvField: 'showImageUrl',
              selector: 'meta[property="og:image"], meta[name="og:image"]',
              attribute: 'content',
              transform: 'trim'
            },
            {
              type: 'field',
              id: 'description',
              csvField: 'showDescription',
              selector: 'meta[property="og:description"], meta[name="og:description"]',
              attribute: 'content',
              transform: 'trim'
            },
            // Precise date + time from the first performance in the .tickets block
            // ("… Tuesday, September 8, 2026 | 7:30PM …"). Overrides the yearless
            // listing date.
            {
              type: 'field',
              id: 'detailDate',
              csvField: 'date',
              selector: '.tickets',
              regex: '([A-Z][a-z]+\\s+\\d{1,2},\\s+\\d{4})',
              transform: 'date'
            },
            {
              type: 'field',
              id: 'detailTime',
              csvField: 'time',
              selector: '.tickets',
              regex: '(\\d{1,2}:\\d{2}\\s*[AP]M)',
              transform: 'time'
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
      console.log('Updated existing Penumbra DataSource:', existing._id.toString())
      return
    }

    const venue = await VenueModel.findOne({ name: { $regex: /penumbra/i } })

    const ds = await DataSourceModel.create({
      name: 'Penumbra Theatre (penumbratheatre.org)',
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
    console.log('Created Penumbra DataSource:', ds._id.toString())
    if (venue) console.log('  associated with venue:', venue._id.toString(), `(${venue.name})`)
  } finally {
    await mongoose.disconnect()
  }
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
