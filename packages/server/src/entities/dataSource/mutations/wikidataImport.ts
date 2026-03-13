import {
  GraphQLString,
  GraphQLNonNull,
  GraphQLList,
  GraphQLObjectType,
  GraphQLInt,
  GraphQLBoolean,
  GraphQLEnumType
} from 'graphql'
import { mutationWithClientMutationId } from 'graphql-relay'
import { errorField } from '../../../graphql/errorField'
import { UserModel } from '../../user/userModel'
import { ShowModel } from '../../show/showModel'
import { VenueModel } from '../../venue/venueModel'
import { ProductionCompanyModel } from '../../productionCompany/productionCompanyModel'
import { PersonModel } from '../../person/personModel'
import { CreditModel } from '../../credit/creditModel'
import { ShowCreditModel } from '../../showCredit/showCreditModel'
import { RunModel } from '../../run/runModel'
import { DataSourceModel } from '../dataSourceModel'
import {
  WikidataAPI,
  extractWikidataId,
  parseCoordinates,
  delay,
  type WikidataPerformance,
  type WikidataVenue
} from '../../../services/wikidata/api'

const toSlug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')

// --- GraphQL Types ---

const WikidataSearchTypeEnum = new GraphQLEnumType({
  name: 'WikidataSearchType',
  values: {
    SHOWS: { value: 'shows' },
    SHOWS_BY_REGION: { value: 'shows_by_region' },
    VENUES: { value: 'venues' },
    COMPANY: { value: 'company' }
  }
})

const WikidataShowResultType = new GraphQLObjectType({
  name: 'WikidataShowResult',
  fields: {
    wikidataId: { type: GraphQLString },
    title: { type: GraphQLString },
    description: { type: GraphQLString },
    performanceType: { type: GraphQLString },
    premiereDate: { type: GraphQLString },
    venueLabel: { type: GraphQLString },
    directorLabel: { type: GraphQLString },
    composerLabel: { type: GraphQLString },
    duration: { type: GraphQLString },
    existsInCurtn: { type: GraphQLBoolean }
  }
})

const WikidataVenueResultType = new GraphQLObjectType({
  name: 'WikidataVenueResult',
  fields: {
    wikidataId: { type: GraphQLString },
    name: { type: GraphQLString },
    capacity: { type: GraphQLString },
    coordinates: { type: GraphQLString },
    website: { type: GraphQLString },
    architectLabel: { type: GraphQLString },
    ownerLabel: { type: GraphQLString },
    openedDate: { type: GraphQLString },
    existsInCurtn: { type: GraphQLBoolean }
  }
})

const ImportResultType = new GraphQLObjectType({
  name: 'WikidataImportResult',
  fields: {
    totalProcessed: { type: GraphQLInt },
    showsCreated: { type: GraphQLInt },
    showsEnriched: { type: GraphQLInt },
    showsSkipped: { type: GraphQLInt },
    venuesCreated: { type: GraphQLInt },
    venuesEnriched: { type: GraphQLInt },
    venuesSkipped: { type: GraphQLInt },
    companiesCreated: { type: GraphQLInt },
    personsCreated: { type: GraphQLInt },
    creditsCreated: { type: GraphQLInt },
    errors: { type: new GraphQLList(GraphQLString) }
  }
})

// --- Search Mutation (preview before import) ---

export const wikidataSearch = mutationWithClientMutationId({
  name: 'wikidataSearch',
  description: 'Search Wikidata for shows or venues to preview before importing',
  inputFields: {
    searchType: { type: new GraphQLNonNull(WikidataSearchTypeEnum) },
    query: {
      type: new GraphQLNonNull(GraphQLString),
      description: 'Search term (show title), city name (for venues/region), or company name'
    },
    yearFrom: {
      type: GraphQLInt,
      description: 'Filter shows premiered on or after this year (for SHOWS_BY_REGION)'
    },
    yearTo: {
      type: GraphQLInt,
      description: 'Filter shows premiered on or before this year (for SHOWS_BY_REGION)'
    },
    limit: { type: GraphQLInt }
  },
  outputFields: {
    shows: {
      type: new GraphQLList(WikidataShowResultType),
      resolve: r => r.shows
    },
    venues: {
      type: new GraphQLList(WikidataVenueResultType),
      resolve: r => r.venues
    },
    ...errorField
  },
  mutateAndGetPayload: async ({ searchType, query, yearFrom, yearTo, limit }, ctx) => {
    if (!ctx.user) return { error: 'Unauthorized' }
    const adminUser = await UserModel.findById(ctx.user.id)
    if (!adminUser?.isAdmin) return { error: 'Admin access required' }

    if (searchType === 'shows') {
      const results = await WikidataAPI.searchTheatricalPerformances(query, limit || 20)

      // Check which already exist in Curtn
      const shows = await Promise.all(results.map(async (r) => {
        const wdId = extractWikidataId(r.item)
        const existsByWikidata = await ShowModel.findOne({ wikidataId: wdId })
        const titleRegex = new RegExp(`^${r.itemLabel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i')
        const existsByTitle = !existsByWikidata ? await ShowModel.findOne({ title: titleRegex }) : null

        return {
          wikidataId: wdId,
          title: r.itemLabel,
          description: r.description,
          performanceType: r.performanceTypeLabel,
          premiereDate: r.premiereDate,
          venueLabel: r.venueLabel,
          directorLabel: r.directorLabel,
          composerLabel: r.composerLabel,
          duration: r.duration,
          existsInCurtn: !!(existsByWikidata || existsByTitle)
        }
      }))

      return { shows, venues: [] }
    }

    if (searchType === 'shows_by_region') {
      const results = await WikidataAPI.searchShowsByRegion(query, yearFrom, yearTo, limit || 50)

      const shows = await Promise.all(results.map(async (r) => {
        const wdId = extractWikidataId(r.item)
        const existsByWikidata = await ShowModel.findOne({ wikidataId: wdId })
        const titleRegex = new RegExp(`^${r.itemLabel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i')
        const existsByTitle = !existsByWikidata ? await ShowModel.findOne({ title: titleRegex }) : null

        return {
          wikidataId: wdId,
          title: r.itemLabel,
          description: r.description,
          performanceType: r.performanceTypeLabel,
          premiereDate: r.premiereDate,
          venueLabel: r.venueLabel,
          directorLabel: r.directorLabel,
          composerLabel: r.composerLabel,
          duration: r.duration,
          existsInCurtn: !!(existsByWikidata || existsByTitle)
        }
      }))

      return { shows, venues: [] }
    }

    if (searchType === 'venues') {
      const results = await WikidataAPI.searchVenuesInCity(query, limit || 50)

      const venues = await Promise.all(results.map(async (r) => {
        const wdId = extractWikidataId(r.venue)
        const existsByWikidata = await VenueModel.findOne({ wikidataId: wdId })
        const slug = toSlug(r.venueLabel)
        const existsBySlug = !existsByWikidata ? await VenueModel.findOne({ slug }) : null

        return {
          wikidataId: wdId,
          name: r.venueLabel,
          capacity: r.capacity,
          coordinates: r.coordinates,
          website: r.website,
          architectLabel: r.architectLabel,
          ownerLabel: r.ownerLabel,
          openedDate: r.openedDate,
          existsInCurtn: !!(existsByWikidata || existsBySlug)
        }
      }))

      return { shows: [], venues }
    }

    if (searchType === 'company') {
      const results = await WikidataAPI.searchPerformancesByCompany(query, limit || 30)

      const shows = await Promise.all(results.map(async (r) => {
        const wdId = extractWikidataId(r.item)
        const existsByWikidata = await ShowModel.findOne({ wikidataId: wdId })
        const titleRegex = new RegExp(`^${r.itemLabel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i')
        const existsByTitle = !existsByWikidata ? await ShowModel.findOne({ title: titleRegex }) : null

        return {
          wikidataId: wdId,
          title: r.itemLabel,
          description: r.description,
          performanceType: r.performanceTypeLabel,
          premiereDate: r.premiereDate,
          venueLabel: r.venueLabel,
          directorLabel: r.directorLabel,
          composerLabel: r.composerLabel,
          duration: r.duration,
          existsInCurtn: !!(existsByWikidata || existsByTitle)
        }
      }))

      return { shows, venues: [] }
    }

    return { error: 'Invalid search type' }
  }
})

// --- Import Mutation ---

export const wikidataImport = mutationWithClientMutationId({
  name: 'wikidataImport',
  description: 'Import selected Wikidata entities into Curtn. Enriches existing records or creates new ones.',
  inputFields: {
    wikidataIds: {
      type: new GraphQLNonNull(new GraphQLList(new GraphQLNonNull(GraphQLString))),
      description: 'Wikidata entity IDs to import (e.g. ["Q19320959", "Q1137861"])'
    },
    entityType: {
      type: new GraphQLNonNull(WikidataSearchTypeEnum),
      description: 'Whether these are show or venue entities'
    },
    city: {
      type: GraphQLString,
      description: 'City context from the search (e.g. "NYC", "Manhattan"). Used to set city/state on new venues.'
    },
    fetchDescriptions: {
      type: GraphQLBoolean,
      description: 'Fetch full intro paragraphs from Wikipedia (slower, 1 req/s). Default: true'
    },
    dryRun: {
      type: GraphQLBoolean,
      description: 'Preview results without creating/updating anything'
    }
  },
  outputFields: {
    result: {
      type: ImportResultType,
      resolve: r => r.result
    },
    ...errorField
  },
  mutateAndGetPayload: async ({ wikidataIds, entityType, city, fetchDescriptions = true, dryRun }, ctx) => {
    if (!ctx.user) return { error: 'Unauthorized' }
    const adminUser = await UserModel.findById(ctx.user.id)
    if (!adminUser?.isAdmin) return { error: 'Admin access required' }

    const result = {
      totalProcessed: wikidataIds.length,
      showsCreated: 0,
      showsEnriched: 0,
      showsSkipped: 0,
      venuesCreated: 0,
      venuesEnriched: 0,
      venuesSkipped: 0,
      companiesCreated: 0,
      personsCreated: 0,
      creditsCreated: 0,
      errors: [] as string[]
    }

    // Find or create the Wikidata DataSource record
    let dataSource = await DataSourceModel.findOne({ name: 'Wikipedia / Wikidata', type: 'api' })
    if (!dataSource && !dryRun) {
      dataSource = await new DataSourceModel({
        name: 'Wikipedia / Wikidata',
        type: 'api',
        url: 'https://query.wikidata.org/sparql',
        config: { provider: 'wikidata' },
        isActive: true,
        createdBy: ctx.user.id
      }).save()
    }

    // Map city input to Curtn city/state values
    const cityStateMap: Record<string, { city: string; state: string }> = {
      'NYC': { city: 'NYC', state: 'NY' },
      'New York': { city: 'NYC', state: 'NY' },
      'Manhattan': { city: 'NYC', state: 'NY' },
      'Brooklyn': { city: 'NYC', state: 'NY' },
      'Minneapolis': { city: 'Minneapolis', state: 'MN' },
      'LA': { city: 'LA', state: 'CA' },
      'Los Angeles': { city: 'LA', state: 'CA' }
    }
    const cityState = cityStateMap[city || 'NYC'] || { city: 'NYC', state: 'NY' }

    if (entityType === 'venues') {
      for (const wdId of wikidataIds) {
        try {
          const details = await WikidataAPI.getVenueDetails(wdId)
          if (!details) {
            result.errors.push(`${wdId}: No data found on Wikidata`)
            continue
          }

          // Try to match existing venue by wikidataId or slug
          const slug = toSlug(details.venueLabel)
          let venue = await VenueModel.findOne({ wikidataId: wdId })
          if (!venue) venue = await VenueModel.findOne({ slug })

          // Parse coordinates from "Point(lng lat)" format
          const coords = parseCoordinates(details.coordinates)

          // Use Wikidata street address if available
          const address = details.address || undefined

          // Fetch Wikipedia description if requested
          let description: string | undefined
          if (fetchDescriptions) {
            description = (await WikidataAPI.getWikipediaIntro(details.venueLabel)) || undefined
            await delay(1000)
          }

          if (venue) {
            if (dryRun) {
              result.venuesEnriched++
              continue
            }
            // Enrich: fill gaps, replace placeholder data
            let changed = false
            if (!venue.wikidataId) { venue.wikidataId = wdId; changed = true }
            if (!venue.description && description) { venue.description = description; changed = true }
            if (!venue.capacity && details.capacity) { venue.capacity = parseInt(details.capacity, 10); changed = true }
            if (!venue.website && details.website) { venue.website = details.website; changed = true }

            // Replace placeholder address
            if (venue.address === 'TBD' && address) {
              venue.address = address
              changed = true
            }

            // Replace default placeholder coordinates with real ones
            const isPlaceholder = (
              (venue.coordinates?.lat === 40.7128 && venue.coordinates?.lng === -74.0060) ||
              (venue.coordinates?.lat === 0 && venue.coordinates?.lng === 0)
            )
            if (coords && isPlaceholder) {
              venue.coordinates = coords
              changed = true
            }

            if (changed) {
              await venue.save()
              result.venuesEnriched++
            } else {
              result.venuesSkipped++
            }
          } else {
            if (dryRun) {
              result.venuesCreated++
              continue
            }
            await new VenueModel({
              name: details.venueLabel,
              slug,
              description,
              address: address || 'TBD',
              city: cityState.city,
              state: cityState.state,
              coordinates: coords || { lat: 40.7128, lng: -74.0060 },
              capacity: details.capacity ? parseInt(details.capacity, 10) : undefined,
              venueType: 'theater',
              website: details.website,
              wikidataId: wdId,
              submittedBy: ctx.user.id
            }).save()
            result.venuesCreated++
          }

          await delay(1000)
        } catch (err: any) {
          result.errors.push(`${wdId}: ${err.message || 'Unknown error'}`)
        }
      }
    }

    if (entityType === 'shows' || entityType === 'company') {
      for (const wdId of wikidataIds) {
        try {
          const details = await WikidataAPI.getPerformanceDetails(wdId)
          if (!details) {
            result.errors.push(`${wdId}: No data found on Wikidata`)
            continue
          }

          // Try to match existing show by wikidataId or exact title
          const titleRegex = new RegExp(`^${details.itemLabel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i')
          let show = await ShowModel.findOne({ wikidataId: wdId })
          if (!show) show = await ShowModel.findOne({ title: titleRegex })

          // Fetch Wikipedia description
          let description: string | undefined
          if (fetchDescriptions) {
            description = (await WikidataAPI.getWikipediaIntro(details.itemLabel)) || details.description || undefined
            await delay(1000)
          } else {
            description = details.description
          }

          // Map Wikidata genre labels to Curtn performanceTypes
          const typeMap: Record<string, string> = {
            'musical theatre': 'musical',
            'musical': 'musical',
            'drama': 'theater',
            'play': 'theater',
            'comedy': 'comedy',
            'opera': 'theater',
            'ballet': 'dance',
            'dance': 'dance',
            'cabaret': 'cabaret',
            'revue': 'cabaret',
            'burlesque': 'burlesque',
            'improvisation': 'improv',
            'spoken word': 'spoken-word'
          }
          const performanceType = details.performanceTypeLabel
            ? typeMap[details.performanceTypeLabel.toLowerCase()] || 'theater'
            : undefined

          if (show) {
            if (dryRun) {
              result.showsEnriched++
              continue
            }
            // Enrich: fill gaps only
            let changed = false
            if (!show.wikidataId) { show.wikidataId = wdId; changed = true }
            if (!show.description && description) { show.description = description; changed = true }
            if (show.duration === 0 && details.duration) {
              show.duration = parseInt(details.duration, 10)
              changed = true
            }
            if (show.performanceTypes.length === 0 && performanceType) {
              show.performanceTypes = [performanceType]
              changed = true
            }
            if (dataSource && !show.source) {
              show.source = dataSource._id
              changed = true
            }

            if (changed) {
              await show.save()
              result.showsEnriched++
            } else {
              result.showsSkipped++
            }
          } else {
            if (dryRun) {
              result.showsCreated++
              continue
            }
            show = await new ShowModel({
              title: details.itemLabel,
              description: description || '',
              performanceTypes: performanceType ? [performanceType] : [],
              duration: details.duration ? parseInt(details.duration, 10) : 0,
              wikidataId: wdId,
              submittedBy: ctx.user.id,
              ...(dataSource && { source: dataSource._id })
            }).save()
            result.showsCreated++
          }

          // Create Person + ShowCredit entries for creative team
          if (!dryRun && show) {
            const creativeRoles: Array<{ label?: string, wikidataUrl?: string, role: string }> = []

            if (details.directorLabel && details.director) {
              creativeRoles.push({ label: details.directorLabel, wikidataUrl: details.director, role: 'Director' })
            }
            if (details.composerLabel && details.composer) {
              creativeRoles.push({ label: details.composerLabel, wikidataUrl: details.composer, role: 'Composer' })
            }
            if (details.lyricistLabel && details.lyricist) {
              creativeRoles.push({ label: details.lyricistLabel, wikidataUrl: details.lyricist, role: 'Lyricist' })
            }
            if (details.choreographerLabel && details.choreographer) {
              creativeRoles.push({ label: details.choreographerLabel, wikidataUrl: details.choreographer, role: 'Choreographer' })
            }

            for (const credit of creativeRoles) {
              if (!credit.label) continue
              const personWdId = extractWikidataId(credit.wikidataUrl!)
              const personSlug = toSlug(credit.label)

              // Find or create Person
              let person = await PersonModel.findOne({ wikidataId: personWdId })
              if (!person) person = await PersonModel.findOne({ slug: personSlug })
              if (!person) {
                person = await new PersonModel({
                  name: credit.label,
                  slug: personSlug,
                  wikidataId: personWdId,
                  submittedBy: ctx.user.id
                }).save()
                result.personsCreated++
              } else if (!person.wikidataId) {
                person.wikidataId = personWdId
                await person.save()
              }

              // Create ShowCredit if it doesn't exist
              const existingCredit = await ShowCreditModel.findOne({
                person: person._id,
                show: show._id,
                role: credit.role
              })
              if (!existingCredit) {
                await new ShowCreditModel({
                  person: person._id,
                  show: show._id,
                  role: credit.role,
                  order: 0,
                  submittedBy: ctx.user.id
                }).save()
                result.creditsCreated++
              }
            }

            // Create Venue + Run linkage if premiere venue is known
            if (details.venueLabel && details.venue) {
              const venueWdId = extractWikidataId(details.venue)
              const venueSlug = toSlug(details.venueLabel)
              let venue = await VenueModel.findOne({ wikidataId: venueWdId })
              if (!venue) venue = await VenueModel.findOne({ slug: venueSlug })
              // Only link to existing venues — don't create venues from show data
              // (venue creation should happen through the venue import flow)

              if (venue) {
                const existingRun = await RunModel.findOne({ show: show._id, venues: venue._id })
                if (!existingRun) {
                  const premiereDate = details.premiereDate ? new Date(details.premiereDate) : undefined
                  await new RunModel({
                    show: show._id,
                    venues: [venue._id],
                    ...(premiereDate && !isNaN(premiereDate.getTime()) && { startDate: premiereDate }),
                    submittedBy: ctx.user.id,
                    ...(dataSource && { source: dataSource._id })
                  }).save()
                }
              }
            }
          }

          await delay(1000)
        } catch (err: any) {
          result.errors.push(`${wdId}: ${err.message || 'Unknown error'}`)
        }
      }
    }

    // Update lastPolledAt on the DataSource
    if (dataSource && !dryRun) {
      dataSource.lastPolledAt = new Date()
      await dataSource.save()
    }

    return { result }
  }
})
