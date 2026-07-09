import '../config/env'
import mongoose from 'mongoose'
import { DataSourceModel } from '../entities/dataSource/dataSourceModel'
import { UserModel } from '../entities/user/userModel'
import { VenueModel } from '../entities/venue/venueModel'
import type { CsvRowInput } from '../services/importEngine'
import { squarespaceConfig } from './squarespaceSource'

// Bulk create/update for the Squarespace venue cluster (Tier D). All share the
// reusable .eventlist-* template (see squarespaceSource.ts) — adding a venue is
// one entry here once you've confirmed it's Squarespace and found its events
// page. Run: `npx ts-node src/scripts/createSquarespaceVenues.ts` (idempotent).
// Then dry-run/stage each via runScraper.ts <id>.

interface SqVenue {
  name: string
  startUrl: string
  rowDefaults: Partial<CsvRowInput>
  detailDescription?: boolean // detail-fetch og:description when listing excerpts are empty
  detailDescriptionSelector?: string // detail-fetch the body synopsis from this selector (when og:description is a poor auto-summary)
}

const VENUES: SqVenue[] = [
  {
    name: 'The Elysian Theater (elysiantheater.com)',
    // The homepage renders the .eventlist (the /shows-calendar page is a calendar embed).
    startUrl: 'https://www.elysiantheater.com/',
    rowDefaults: {
      venueName: 'The Elysian Theater',
      venueAddress: '1944 Riverside Dr',
      venueCity: 'Los Angeles',
      venueState: 'CA',
      venueZipCode: '90039',
      performanceTypes: 'comedy'
    }
  },
  {
    name: 'East West Players (eastwestplayers.org)',
    startUrl: 'https://eastwestplayers.org/events',
    detailDescription: true, // listing excerpts are empty — pull synopsis from event pages
    rowDefaults: {
      venueName: 'East West Players',
      venueAddress: '400 W Washington Blvd',
      venueCity: 'Los Angeles',
      venueState: 'CA',
      venueZipCode: '90015',
      performanceTypes: 'theater'
    }
  },
  {
    name: 'American Opera Projects (operaprojects.org)',
    startUrl: 'https://operaprojects.org/events',
    rowDefaults: {
      venueName: 'American Opera Projects',
      venueAddress: '321 Ashland Pl',
      venueCity: 'Brooklyn',
      venueState: 'NY',
      venueZipCode: '11217',
      performanceTypes: 'opera'
    }
  },
  // Address not auto-extractable (likely in images/JS) — venueName + city/state
  // only; street address needs enrichment (geocoding pass / manual). Events still flow.
  {
    name: 'The Fountain Theatre (fountaintheatre.com)',
    startUrl: 'https://fountaintheatre.com/events',
    rowDefaults: { venueName: 'The Fountain Theatre', venueCity: 'Los Angeles', venueState: 'CA', performanceTypes: 'theater' }
  },
  {
    name: 'In the Heart of the Beast (hobt.org)',
    startUrl: 'https://www.hobt.org/events',
    // .eventlist-excerpt is a truncated blurb and og:description is a caption
    // ("ASL interpreter available") — pull the real synopsis from the event
    // body (.eventitem-column-content, the Squarespace Events item body).
    detailDescriptionSelector: '.eventitem-column-content',
    rowDefaults: { venueName: 'In the Heart of the Beast', venueCity: 'Minneapolis', venueState: 'MN', performanceTypes: 'theater' }
  },
  {
    name: 'The Flea Theater (theflea.org)',
    startUrl: 'https://www.theflea.org/events',
    rowDefaults: { venueName: 'The Flea Theater', venueCity: 'New York', venueState: 'NY', performanceTypes: 'theater' }
  }
  // FACTORY-READY when its new season posts clean upcoming events: Ensemble Studio
  // Theatre — standard Squarespace events collection at
  // https://www.ensemblestudiotheatre.org/20252026 (detailDescription: true,
  // 549 West 52nd St, NYC 10019, theater). Held off 2026-06: only 1 --upcoming
  // event remained (season ending) and it was a multi-date recurring blob whose
  // .eventlist-meta-date doesn't parse; no poster/excerpt. Re-add the registry
  // entry once the 2026-27 collection has clean single-date upcoming events.
  // NEEDS DIFFERENT HANDLING (no standard --upcoming eventlist on probed pages —
  // likely a JS calendar block, not the Events list view): Park Square Theatre
  // (parksquaretheatre.org), The Duplex (theduplex.com). Find their list-view
  // page or handle the calendar block before adding.
  // More Squarespace candidates detected (no eventlist found on probed paths —
  // events may be on a differently-named page or use a calendar block):
  // accesstheater, coeurage, connellytheater, engardearts, houseofyes, jackny,
  // packtheater, dynastytypewriter, clubcummingnyc, latteda, jungletheater, etc.
]

async function main() {
  const mongoUrl = process.env.MONGODB_URL
  if (!mongoUrl) throw new Error('MONGODB_URL not set')
  await mongoose.connect(mongoUrl)
  try {
    const admin = await UserModel.findOne({ isAdmin: true })
    if (!admin) throw new Error('No admin user found — run setAdmin first')

    for (const v of VENUES) {
      const config = squarespaceConfig({ startUrl: v.startUrl, rowDefaults: v.rowDefaults, detailDescription: v.detailDescription, detailDescriptionSelector: v.detailDescriptionSelector })
      const existing = await DataSourceModel.findOne({ type: 'scraper', url: v.startUrl })
      if (existing) {
        existing.config = config as unknown as Record<string, any>
        existing.consecutiveFailures = 0
        existing.disabledReason = undefined
        existing.isActive = true
        await existing.save()
        console.log(`Updated ${v.name}: ${existing._id.toString()}`)
        continue
      }
      const venueName = v.rowDefaults.venueName as string
      const venue = venueName
        ? await VenueModel.findOne({ name: { $regex: `^${venueName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: 'i' } })
        : null
      const ds = await DataSourceModel.create({
        name: v.name,
        type: 'scraper',
        purpose: 'scraper',
        url: v.startUrl,
        config: config as unknown as Record<string, any>,
        associatedVenue: venue?._id,
        createdBy: admin._id,
        isActive: true,
        consecutiveFailures: 0,
        cooldownHours: 24
      })
      console.log(`Created ${v.name}: ${ds._id.toString()}`)
    }
  } finally {
    await mongoose.disconnect()
  }
}

main().catch(err => { console.error(err); process.exit(1) })
