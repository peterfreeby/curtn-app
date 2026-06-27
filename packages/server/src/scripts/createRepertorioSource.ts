import '../config/env'
import mongoose from 'mongoose'
import { DataSourceModel } from '../entities/dataSource/dataSourceModel'
import { UserModel } from '../entities/user/userModel'
import { VenueModel } from '../entities/venue/venueModel'
import type { ScraperDataSourceConfig } from '../services/scraping/types'

// Repertorio Español — Spanish-language repertory theater, Gramercy.
// Nuxt SPA: /en/calendar lists one .ShowCard per show. The serialized DOM
// splits each card into two sibling .ShowCard nodes — one carries the cover +
// date, the other the title — so the listing can only reliably yield title +
// detail URL (the date-only twin drops, missing a title). Everything else
// (date/time/poster/description/real Salesforce ticket URL/cast) comes from the
// detail page (/show/<id>/<slug>), which we detail-follow. The detail date is
// pulled from the first card of the performance-date swiper (next performance).

const CONFIG: ScraperDataSourceConfig = {
  startUrl: 'https://repertorio.nyc/en/calendar',
  strategy: {
    mode: 'template',
    template: {
      version: 2,
      nodes: [
        {
          type: 'container',
          id: 'events',
          label: 'Events',
          selector: '.ShowCard',
          children: [
            {
              // Only the title-bearing twin survives (the date-only twin has no
              // title and is dropped). Detail-follow fills the rest.
              type: 'field',
              id: 'title',
              csvField: 'title',
              selector: '.ShowCard__title',
              transform: 'trim'
            },
            {
              // Card itself is the <a> to the show detail page.
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
  rowDefaults: {
    venueName: 'Repertorio Español',
    venueAddress: '138 East 27th Street',
    venueCity: 'New York',
    venueState: 'NY',
    venueZipCode: '10016',
    performanceTypes: 'theater'
  },
  maxItems: 50,
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
          selector: '.Show',
          children: [
            {
              // Clean title from the hero (overrides the listing title).
              type: 'field',
              id: 'detailTitle',
              csvField: 'title',
              selector: 'h1.Header__title',
              transform: 'trim'
            },
            {
              // First card of the performance-date swiper = next performance.
              // Combined text is "June27Sat | 7:00PM"; capture "June27" — V8's
              // Date parses it and the engine infers the year.
              type: 'field',
              id: 'date',
              csvField: 'date',
              selector: '.ShowCardsDate__card',
              regex: '^([A-Za-z]+\\d{1,2})',
              transform: 'date'
            },
            {
              type: 'field',
              id: 'time',
              csvField: 'time',
              selector: '.ShowCardsDate__time',
              regex: '(\\d{1,2}:\\d{2}\\s*(?:AM|PM|am|pm))',
              transform: 'time'
            },
            {
              // First .ShowInfos__text is the full synopsis (a second, empty one
              // follows). .Footer__text is also .Wysiwyg, so scope to ShowInfos.
              type: 'field',
              id: 'fullDescription',
              csvField: 'showDescription',
              selector: '.ShowInfos__text',
              transform: 'trim'
            },
            {
              // Real ticket link (Salesforce) on the header CTA. The listing's
              // own link is internal (/show/...), so only the detail gives a
              // real external ticket URL.
              type: 'field',
              id: 'ticketUrl',
              csvField: 'ticketUrl',
              selector: '.Header__buttons a[href^="http"]',
              attribute: 'href',
              transform: 'trim'
            },
            {
              type: 'field',
              id: 'headerPoster',
              csvField: 'showImageUrl',
              selector: '.Header__media img.Cover__img',
              attribute: 'src',
              transform: 'trim'
            },
            {
              // Cast + creative cards. Role isn't exposed per card, so these
              // stage as credits (creditType='cast'). No section → zero matches
              // → falls back to the single parent row (no fan-out).
              type: 'container',
              id: 'castMembers',
              label: 'Cast & creative',
              selector: '.AlumPeople__card',
              children: [
                {
                  type: 'field',
                  id: 'personName',
                  csvField: 'personName',
                  selector: '.AlumPeople__name',
                  transform: 'trim'
                },
                {
                  type: 'field',
                  id: 'personHeadshotUrl',
                  csvField: 'personHeadshotUrl',
                  selector: 'img.Cover__img',
                  attribute: 'src',
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
      url: CONFIG.startUrl
    })
    if (existing) {
      existing.config = CONFIG
      existing.consecutiveFailures = 0
      existing.disabledReason = undefined
      existing.isActive = true
      await existing.save()
      console.log('Updated existing Repertorio DataSource:', existing._id.toString())
      return
    }

    const venue = await VenueModel.findOne({
      name: { $regex: /^repertorio/i }
    })

    const ds = await DataSourceModel.create({
      name: 'Repertorio Español (repertorio.nyc)',
      type: 'scraper',
      url: CONFIG.startUrl,
      config: CONFIG,
      associatedVenue: venue?._id,
      createdBy: admin._id,
      isActive: true,
      consecutiveFailures: 0,
      cooldownHours: 24
    })
    console.log('Created Repertorio DataSource:', ds._id.toString())
    if (venue) console.log('  associated with venue:', venue._id.toString(), `(${venue.name})`)
    else console.log('  no existing Repertorio venue found — scraper will create one on first run')
  } finally {
    await mongoose.disconnect()
  }
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
