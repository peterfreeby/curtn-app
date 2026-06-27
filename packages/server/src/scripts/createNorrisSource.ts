import '../config/env'
import mongoose from 'mongoose'
import { DataSourceModel } from '../entities/dataSource/dataSourceModel'
import { UserModel } from '../entities/user/userModel'
import { VenueModel } from '../entities/venue/venueModel'
import type { ScraperDataSourceConfig } from '../services/scraping/types'

// Norris Theatre / Palos Verdes Performing Arts (palosverdesperformingarts.com) —
// Tier 2 template off the homepage "upcoming shows" grid. adx CMS (same family as
// Antaeus/Wallis). Each .item card carries the poster, title (h3 a →
// /show-details/<slug>) and full description (.inner-content-description-upcoming-shows).
// The card's date badge is only a day number, so the run date comes from the
// detail page's <time> element ("Jul 25, 2026 - 8:00 PM" / "Apr 16, 2027 - Apr 25,
// 2027"). The /show-details page is the canonical buy page (adx), used as ticketUrl.
//
// The grid mixes professional programming (Disney's Frozen, One Night of Queen,
// cabaret-jazz series) with venue RENTALS (dance-school recitals, slug "rental-…").
// We stage the detail href as ticketUrl so excludeUrlPatterns can drop the rentals
// pre-detail.

const CONFIG: ScraperDataSourceConfig = {
  startUrl: 'https://palosverdesperformingarts.com/',
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
            { type: 'field', id: 'title', csvField: 'title', selector: 'h3 a', transform: 'trim' },
            { type: 'field', id: 'description', csvField: 'showDescription', selector: '.inner-content-description-upcoming-shows', transform: 'trim' },
            { type: 'field', id: 'poster', csvField: 'showImageUrl', selector: 'img', attribute: 'src', transform: 'trim' },
            { type: 'field', id: 'ticketUrl', csvField: 'ticketUrl', selector: 'a[href*="/show-details/"]', attribute: 'href', transform: 'trim' },
            { type: 'field', id: 'detailUrl', csvField: '_detailUrl', selector: 'a[href*="/show-details/"]', attribute: 'href', transform: 'trim' }
          ]
        }
      ]
    }
  },
  rowDefaults: {
    venueName: 'Norris Theatre',
    venueAddress: '27570 Norris Center Dr',
    venueCity: 'Rolling Hills Estates',
    venueState: 'CA',
    venueZipCode: '90274'
  },
  excludeUrlPatterns: ['rental'],
  maxItems: 40,
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
          selector: 'body',
          children: [
            {
              // The single <time> is "Jul 25, 2026 - 8:00 PM" (date + showtime) or
              // a true range "Apr 16, 2027 - Apr 25, 2027". The date-range transform
              // mis-reads the "8:00 PM" half as a date, so capture just the first
              // calendar date and parse it. (Multi-day runs keep their start date;
              // most Norris events are single-night concerts.)
              type: 'field',
              id: 'date',
              csvField: 'date',
              selector: 'time',
              regex: '([A-Za-z]{3,9}\\.?\\s+\\d{1,2},\\s*\\d{4})',
              transform: 'date'
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
    if (!admin) throw new Error('No admin user found')
    const existing = await DataSourceModel.findOne({ type: 'scraper', url: CONFIG.startUrl })
    if (existing) {
      existing.config = CONFIG
      existing.consecutiveFailures = 0
      existing.disabledReason = undefined
      existing.isActive = true
      await existing.save()
      console.log('Updated existing Norris DataSource:', existing._id.toString())
      return
    }
    const venue = await VenueModel.findOne({ name: { $regex: /norris/i } })
    const ds = await DataSourceModel.create({
      name: 'Norris Theatre (palosverdesperformingarts.com)',
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
    console.log('Created Norris DataSource:', ds._id.toString())
    if (venue) console.log('  associated with venue:', venue._id.toString(), `(${venue.name})`)
  } finally {
    await mongoose.disconnect()
  }
}

main().catch(err => { console.error(err); process.exit(1) })
