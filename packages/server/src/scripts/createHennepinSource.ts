import '../config/env'
import mongoose from 'mongoose'
import { DataSourceModel } from '../entities/dataSource/dataSourceModel'
import { UserModel } from '../entities/user/userModel'
import { VenueModel } from '../entities/venue/venueModel'
import type { ScraperDataSourceConfig } from '../services/scraping/types'

// Hennepin Arts (hennepinarts.org) — touring Broadway/comedy/music across the
// Orpheum, State, Pantages, New Century, and Dudley Riggs. Nuxt SPA backed by
// Contentful; the listing card date is junk ("Now through November 7"), but the
// detail pages (/events/<slug>) carry a rich schema.org Event JSON-LD with
// name, startDate, endDate, description, image, and — crucially — the SPECIFIC
// venue (location.name), which solves the per-row venue problem for a touring org.
//
// So: the listing just harvests detail URLs; detail-fetch with `jsonLd: true`
// pulls the structured fields from each event's JSON-LD (Tier-1-quality).

export const CONFIG: ScraperDataSourceConfig = {
  startUrl: 'https://hennepinarts.org/events',
  strategy: {
    mode: 'template',
    template: {
      version: 2,
      nodes: [
        {
          type: 'container',
          id: 'events',
          label: 'Events',
          selector: '.item',
          children: [
            // Title for fingerprint/fallback; JSON-LD overrides it on the merge.
            { type: 'field', id: 'title', csvField: 'title', selector: '.decoration-3', transform: 'trim' },
            {
              type: 'field',
              id: 'detailUrl',
              csvField: '_detailUrl',
              selector: 'a[href*="/events/"]',
              attribute: 'href',
              transform: 'trim'
            },
            {
              // Fallback ticketing link; the detail Ticketmaster link overrides
              // it when present.
              type: 'field',
              id: 'ticketFallback',
              csvField: 'ticketUrl',
              selector: 'a[href*="/events/"]',
              attribute: 'href',
              transform: 'trim'
            }
          ]
        }
      ]
    }
  },
  rowDefaults: {
    // venueName intentionally omitted — comes from each event's JSON-LD location
    // (Orpheum / State / Pantages / etc.). City/state are constant.
    venueCity: 'Minneapolis',
    venueState: 'MN'
  },
  maxItems: 60,
  detail: {
    fromField: '_detailUrl',
    fingerprint: ['title'],
    jsonLd: true, // pull title/date/description/venue from the detail Event JSON-LD
    // The JSON-LD image is an @id ref (no usable URL) and there are no offers,
    // so a template layer adds the og:image poster and the Ticketmaster link.
    template: {
      version: 2,
      nodes: [
        {
          type: 'container',
          id: 'detail',
          label: 'Detail DOM fields',
          selector: 'html',
          children: [
            { type: 'field', id: 'poster', csvField: 'showImageUrl', selector: 'meta[property="og:image"]', attribute: 'content', transform: 'trim' },
            { type: 'field', id: 'ticketUrl', csvField: 'ticketUrl', selector: 'a[href*="ticketmaster"]', attribute: 'href', transform: 'trim' }
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
      console.log('Updated existing Hennepin Arts DataSource:', existing._id.toString())
      return
    }

    const ds = await DataSourceModel.create({
      name: 'Hennepin Arts (hennepinarts.org)',
      type: 'scraper',
      purpose: 'scraper',
      url: CONFIG.startUrl,
      config: CONFIG,
      createdBy: admin._id,
      isActive: true,
      consecutiveFailures: 0,
      cooldownHours: 24
    })
    console.log('Created Hennepin Arts DataSource:', ds._id.toString())
  } finally {
    await mongoose.disconnect()
  }
}

if (require.main === module) main().catch(err => {
  console.error(err)
  process.exit(1)
})
