import {
  GraphQLString,
  GraphQLNonNull,
  GraphQLList,
  GraphQLObjectType,
  GraphQLInt,
  GraphQLInputObjectType,
  GraphQLBoolean
} from 'graphql'
import { mutationWithClientMutationId } from 'graphql-relay'
import { errorField } from '../../../graphql/errorField'
import { UserModel } from '../../user/userModel'
import { ShowModel } from '../../show/showModel'
import { RunModel } from '../../run/runModel'
import { PerformanceModel } from '../../performance/performanceModel'
import { VenueModel } from '../../venue/venueModel'
import { ProductionCompanyModel } from '../../productionCompany/productionCompanyModel'
import { DataSourceModel } from '../dataSourceModel'
import { ensureDefaultStage } from '../../stage/ensureDefaultStage'
import { StageModel } from '../../stage/stageModel'
import { PersonModel } from '../../person/personModel'
import { CreditModel } from '../../credit/creditModel'
import { ShowCreditModel } from '../../showCredit/showCreditModel'

const CsvRowInput = new GraphQLInputObjectType({
  name: 'CsvRowInput',
  fields: {
    // Show fields
    title: { type: new GraphQLNonNull(GraphQLString) },
    showDescription: { type: GraphQLString },
    performanceTypes: { type: GraphQLString },    // comma-separated
    duration: { type: GraphQLString },             // minutes as string
    showUrl: { type: GraphQLString },              // show website
    showImageUrl: { type: GraphQLString },         // show poster/image URL
    languages: { type: GraphQLString },            // comma-separated

    // Venue fields
    venueName: { type: GraphQLString },
    stageName: { type: GraphQLString },
    venueDescription: { type: GraphQLString },
    venueAddress: { type: GraphQLString },
    venueCity: { type: GraphQLString },            // NYC, Minneapolis, LA
    venueState: { type: GraphQLString },           // NY, MN, CA
    venueZipCode: { type: GraphQLString },
    venueCapacity: { type: GraphQLString },        // number as string
    venueType: { type: GraphQLString },            // theater, concert-hall, etc.
    venueWebsite: { type: GraphQLString },
    venuePhone: { type: GraphQLString },
    venueEmail: { type: GraphQLString },
    venueImageUrl: { type: GraphQLString },

    // Run fields
    runTitle: { type: GraphQLString },
    runDescription: { type: GraphQLString },
    runStartDate: { type: GraphQLString },
    runEndDate: { type: GraphQLString },
    intermissions: { type: GraphQLString },        // number as string
    runImageUrl: { type: GraphQLString },

    // Performance fields
    date: { type: GraphQLString },                 // ISO date or parseable date string
    time: { type: GraphQLString },                 // e.g. "7:30 PM"
    startTime: { type: GraphQLString },            // alias for time
    endTime: { type: GraphQLString },              // used to infer duration
    ticketUrl: { type: GraphQLString },
    performanceDescription: { type: GraphQLString },
    soldOut: { type: GraphQLString },              // "true", "yes", "1"

    // Company fields
    companyName: { type: GraphQLString },
    companyDescription: { type: GraphQLString },
    companyLogoUrl: { type: GraphQLString },

    // Credit fields
    personName: { type: GraphQLString },
    personRole: { type: GraphQLString },           // e.g. "Hamlet", "Director", "Playwright"
    creditType: { type: GraphQLString },           // cast, crew, or creator (show-level)
    creditDepartment: { type: GraphQLString },     // cast, crew, creative, production, music
  }
})

const ImportResultType = new GraphQLObjectType({
  name: 'CsvImportResult',
  fields: {
    totalRows: { type: GraphQLInt },
    showsCreated: { type: GraphQLInt },
    showsMatched: { type: GraphQLInt },
    runsCreated: { type: GraphQLInt },
    runsMatched: { type: GraphQLInt },
    performancesCreated: { type: GraphQLInt },
    performancesMatched: { type: GraphQLInt },
    venuesCreated: { type: GraphQLInt },
    venuesMatched: { type: GraphQLInt },
    companiesCreated: { type: GraphQLInt },
    companiesMatched: { type: GraphQLInt },
    personsCreated: { type: GraphQLInt },
    personsMatched: { type: GraphQLInt },
    creditsCreated: { type: GraphQLInt },
    errors: { type: new GraphQLList(GraphQLString) }
  }
})

// Parse "7:30 PM", "19:30", "7:30pm" etc. to minutes since midnight
function parseTimeToMinutes(timeStr: string): number | null {
  // Try 24h format: "19:30"
  const match24 = timeStr.match(/^(\d{1,2}):(\d{2})$/)
  if (match24) {
    return parseInt(match24[1], 10) * 60 + parseInt(match24[2], 10)
  }
  // Try 12h format: "7:30 PM", "7:30pm"
  const match12 = timeStr.match(/^(\d{1,2}):(\d{2})\s*(am|pm)$/i)
  if (match12) {
    let hours = parseInt(match12[1], 10)
    const minutes = parseInt(match12[2], 10)
    const isPM = match12[3].toLowerCase() === 'pm'
    if (isPM && hours !== 12) hours += 12
    if (!isPM && hours === 12) hours = 0
    return hours * 60 + minutes
  }
  return null
}

export const csvImport = mutationWithClientMutationId({
  name: 'csvImport',
  description: 'Bulk import performances from CSV data',
  inputFields: {
    rows: {
      type: new GraphQLNonNull(new GraphQLList(new GraphQLNonNull(CsvRowInput)))
    },
    dataSourceId: {
      type: GraphQLString,
      description: 'Optional DataSource ID to tag imported data'
    },
    dryRun: {
      type: GraphQLBoolean,
      description: 'If true, preview results without creating anything'
    }
  },
  outputFields: {
    result: {
      type: ImportResultType,
      resolve: r => r.result
    },
    ...errorField
  },
  mutateAndGetPayload: async ({ rows, dataSourceId, dryRun }, ctx) => {
    if (!ctx.user) return { error: 'Unauthorized' }

    const adminUser = await UserModel.findById(ctx.user.id)
    if (!adminUser?.isAdmin) return { error: 'Admin access required' }

    const result = {
      totalRows: rows.length,
      showsCreated: 0,
      showsMatched: 0,
      runsCreated: 0,
      runsMatched: 0,
      performancesCreated: 0,
      performancesMatched: 0,
      venuesCreated: 0,
      venuesMatched: 0,
      companiesCreated: 0,
      companiesMatched: 0,
      personsCreated: 0,
      personsMatched: 0,
      creditsCreated: 0,
      errors: [] as string[]
    }

    // Resolve dataSource if provided
    let sourceId: string | undefined
    if (dataSourceId) {
      const ds = await DataSourceModel.findById(dataSourceId)
      if (ds) sourceId = ds._id.toString()
    }

    // Helper: generate slug from string
    const toSlug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')

    // Helper: parse soldOut from various truthy strings
    const parseSoldOut = (val?: string): boolean => {
      if (!val) return false
      const v = val.trim().toLowerCase()
      return ['true', 'yes', '1', 'sold out', 'soldout'].includes(v)
    }

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]
      const rowNum = i + 1

      try {
        if (!row.title?.trim()) {
          result.errors.push(`Row ${rowNum}: Missing title`)
          continue
        }

        // 1. Find or create Show
        const titleClean = row.title.trim()
        const titleRegex = new RegExp(`^${titleClean.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i')
        let show = await ShowModel.findOne({ title: titleRegex })

        if (show) {
          result.showsMatched++
        } else {
          if (dryRun) {
            result.showsCreated++
            continue // Skip rest in dry run for new shows
          }
          const types = row.performanceTypes
            ? row.performanceTypes.split(',').map((t: string) => t.trim().toLowerCase())
            : []
          // Infer duration from startTime/endTime if no explicit duration
          let duration = row.duration ? parseInt(row.duration, 10) || 0 : 0
          if (!duration && row.startTime?.trim() && row.endTime?.trim()) {
            const start = parseTimeToMinutes(row.startTime.trim())
            const end = parseTimeToMinutes(row.endTime.trim())
            if (start !== null && end !== null) {
              duration = end > start ? end - start : (end + 1440) - start
            }
          }

          const langs = row.languages
            ? row.languages.split(',').map((l: string) => l.trim()).filter(Boolean)
            : ['English']

          show = await new ShowModel({
            title: titleClean,
            description: row.showDescription?.trim() || '',
            performanceTypes: types,
            duration,
            languages: langs,
            ...(row.showUrl?.trim() && { url: row.showUrl.trim() }),
            ...(row.showImageUrl?.trim() && { imageUrl: row.showImageUrl.trim() }),
            submittedBy: ctx.user.id,
            ...(sourceId && { source: sourceId })
          }).save()
          result.showsCreated++
        }

        if (dryRun) continue

        // 2. Find or create Venue + Stage (if provided)
        let venueIds: string[] = []
        let stageId: string | undefined
        if (row.venueName?.trim()) {
          const venueSlug = toSlug(row.venueName.trim())
          let venue = await VenueModel.findOne({ slug: venueSlug })
          if (!venue) {
            venue = await new VenueModel({
              name: row.venueName.trim(),
              slug: venueSlug,
              address: row.venueAddress?.trim() || 'TBD',
              city: row.venueCity?.trim() || 'NYC',
              state: row.venueState?.trim() || 'NY',
              coordinates: { lat: 40.7128, lng: -74.0060 },
              ...(row.venueDescription?.trim() && { description: row.venueDescription.trim() }),
              ...(row.venueZipCode?.trim() && { zipCode: row.venueZipCode.trim() }),
              ...(row.venueCapacity?.trim() && { capacity: parseInt(row.venueCapacity, 10) || undefined }),
              ...(row.venueType?.trim() && { venueType: row.venueType.trim().toLowerCase() }),
              ...(row.venueWebsite?.trim() && { website: row.venueWebsite.trim() }),
              ...(row.venuePhone?.trim() && { phone: row.venuePhone.trim() }),
              ...(row.venueEmail?.trim() && { email: row.venueEmail.trim() }),
              ...(row.venueImageUrl?.trim() && { imageUrl: row.venueImageUrl.trim() }),
              submittedBy: ctx.user.id
            }).save()
            result.venuesCreated++
          } else {
            result.venuesMatched++
          }
          venueIds = [venue._id.toString()]
          // Ensure venue has a default stage
          const defaultStage = await ensureDefaultStage(venue._id, ctx.user.id)

          // Find or create a named stage if provided
          if (row.stageName?.trim()) {
            const stageSlug = toSlug(row.stageName.trim())
            let stage = await StageModel.findOne({ venue: venue._id, slug: stageSlug })
            if (!stage) {
              stage = await new StageModel({
                name: row.stageName.trim(),
                slug: stageSlug,
                venue: venue._id,
                isDefault: false,
                submittedBy: ctx.user.id
              }).save()
            }
            stageId = stage._id.toString()
          } else {
            stageId = defaultStage._id.toString()
          }
        }

        // 3. Find or create ProductionCompany (if provided)
        let companyId: string | undefined
        if (row.companyName?.trim()) {
          const companySlug = toSlug(row.companyName.trim())
          let company = await ProductionCompanyModel.findOne({ slug: companySlug })
          if (!company) {
            company = await new ProductionCompanyModel({
              name: row.companyName.trim(),
              slug: companySlug,
              ...(row.companyDescription?.trim() && { description: row.companyDescription.trim() }),
              ...(row.companyLogoUrl?.trim() && { logoUrl: row.companyLogoUrl.trim() }),
              submittedBy: ctx.user.id
            }).save()
            result.companiesCreated++
          } else {
            result.companiesMatched++
          }
          companyId = company._id.toString()
        }

        // 4. Find or create Run
        const runQuery: any = { show: show._id }
        if (companyId) runQuery.productionCompany = companyId
        let run = await RunModel.findOne(runQuery)

        if (run) {
          // Merge venue if not already present
          if (venueIds.length > 0) {
            const existingVenues = run.venues.map((v: any) => v.toString())
            const newVenues = venueIds.filter(v => !existingVenues.includes(v))
            if (newVenues.length > 0) {
              run.venues.push(...newVenues as any)
              await run.save()
            }
          }
          result.runsMatched++
        } else {
          // Parse explicit run dates if provided
          const runStartDate = row.runStartDate?.trim() ? new Date(row.runStartDate.trim()) : undefined
          const runEndDate = row.runEndDate?.trim() ? new Date(row.runEndDate.trim()) : undefined

          run = await new RunModel({
            show: show._id,
            ...(row.runTitle?.trim() && { title: row.runTitle.trim() }),
            ...(row.runDescription?.trim() && { description: row.runDescription.trim() }),
            productionCompany: companyId,
            venues: venueIds,
            ...(stageId && { stage: stageId }),
            ...(row.intermissions?.trim() && { intermissions: parseInt(row.intermissions, 10) || 0 }),
            ...(runStartDate && !isNaN(runStartDate.getTime()) && { startDate: runStartDate }),
            ...(runEndDate && !isNaN(runEndDate.getTime()) && { endDate: runEndDate }),
            ...(row.runImageUrl?.trim() && { imageUrl: row.runImageUrl.trim() }),
            submittedBy: ctx.user.id,
            ...(sourceId && { source: sourceId })
          }).save()
          result.runsCreated++
        }

        // 5. Create Performance (if date provided)
        let performance: any = null
        if (row.date?.trim()) {
          if (venueIds.length === 0) {
            result.errors.push(`Row ${rowNum}: Cannot create performance without a venue`)
          } else {
            const perfDate = new Date(row.date.trim())
            if (isNaN(perfDate.getTime())) {
              result.errors.push(`Row ${rowNum}: Invalid date "${row.date}"`)
            } else {
              // Dedup: check if a performance already exists for this run + date
              const dayStart = new Date(perfDate)
              dayStart.setHours(0, 0, 0, 0)
              const dayEnd = new Date(perfDate)
              dayEnd.setHours(23, 59, 59, 999)
              const existingPerf = await PerformanceModel.findOne({
                run: run._id,
                date: { $gte: dayStart, $lte: dayEnd }
              })

              if (existingPerf) {
                result.performancesMatched++
                performance = existingPerf
              } else {
                performance = await new PerformanceModel({
                  run: run._id,
                  date: perfDate,
                  time: row.time?.trim() || row.startTime?.trim() || '',
                  venueId: venueIds[0],
                  ticketUrl: row.ticketUrl?.trim() || '',
                  soldOut: parseSoldOut(row.soldOut),
                  ...(row.performanceDescription?.trim() && {
                    metadataOverrides: { description: row.performanceDescription.trim() }
                  }),
                  submittedBy: ctx.user.id,
                  ...(sourceId && { source: sourceId })
                }).save()
                result.performancesCreated++
              }

              // Auto-extend run dates
              if (!run.startDate || perfDate < new Date(run.startDate as any)) {
                run.startDate = perfDate
              }
              if (!run.endDate || perfDate > new Date(run.endDate as any)) {
                run.endDate = perfDate
              }
              await run.save()
            }
          }
        }

        // 6. Create Credit (if personName provided)
        // Inference rules:
        //   - creditType "creator" or no run/performance context → ShowCredit (show-level)
        //   - Has date/time (performance exists) → performance-level credit (creditOverrides.added)
        //   - Has venue/run/company context but no date → run-level Credit
        //   - Fallback: run-level Credit (if run exists)
        if (row.personName?.trim() && row.personRole?.trim()) {
          const personSlug = toSlug(row.personName.trim())
          let person = await PersonModel.findOne({ slug: personSlug })
          if (!person) {
            person = await new PersonModel({
              name: row.personName.trim(),
              slug: personSlug,
              submittedBy: ctx.user.id
            }).save()
            result.personsCreated++
          } else {
            result.personsMatched++
          }

          const creditTypeRaw = (row.creditType || row.creditDepartment || 'cast').trim().toLowerCase()
          const isCreator = creditTypeRaw === 'creator' || creditTypeRaw === 'creative'
          const hasPerformanceContext = !!(row.date?.trim() && performance)
          const hasRunContext = !!(row.venueName?.trim() || row.runTitle?.trim() || row.companyName?.trim())

          if (isCreator || (!hasRunContext && !hasPerformanceContext)) {
            // Show-level credit (ShowCredit)
            const existing = await ShowCreditModel.findOne({
              person: person._id,
              show: show._id,
              role: row.personRole.trim()
            })
            if (!existing) {
              await new ShowCreditModel({
                person: person._id,
                show: show._id,
                role: row.personRole.trim(),
                order: 0,
                submittedBy: ctx.user.id
              }).save()
              result.creditsCreated++
            }
          } else if (hasPerformanceContext && performance) {
            // Performance-level: create a run credit, then add to performance's creditOverrides.added
            const runCreditType = ['crew', 'production', 'music'].includes(creditTypeRaw) ? 'crew' : 'cast'
            let credit = await CreditModel.findOne({
              person: person._id,
              run: run._id,
              role: row.personRole.trim()
            })
            if (!credit) {
              credit = await new CreditModel({
                person: person._id,
                run: run._id,
                creditType: runCreditType,
                role: row.personRole.trim(),
                order: 0,
                submittedBy: ctx.user.id
              }).save()
              result.creditsCreated++
            }
            // Add to performance creditOverrides if not already there
            if (!performance.creditOverrides) {
              performance.creditOverrides = { added: [], removed: [] }
            }
            const creditIdStr = credit._id.toString()
            const alreadyAdded = performance.creditOverrides.added?.some(
              (id: any) => id.toString() === creditIdStr
            )
            if (!alreadyAdded) {
              performance.creditOverrides.added.push(credit._id)
              await performance.save()
            }
          } else {
            // Run-level credit (default)
            const runCreditType = ['crew', 'production', 'music'].includes(creditTypeRaw) ? 'crew' : 'cast'
            const existing = await CreditModel.findOne({
              person: person._id,
              run: run._id,
              role: row.personRole.trim()
            })
            if (!existing) {
              await new CreditModel({
                person: person._id,
                run: run._id,
                creditType: runCreditType,
                role: row.personRole.trim(),
                order: 0,
                submittedBy: ctx.user.id
              }).save()
              result.creditsCreated++
            }
          }
        }

      } catch (err: any) {
        result.errors.push(`Row ${rowNum}: ${err.message || 'Unknown error'}`)
      }
    }

    return { result }
  }
})
