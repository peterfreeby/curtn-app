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

const CsvRowInput = new GraphQLInputObjectType({
  name: 'CsvRowInput',
  fields: {
    title: { type: new GraphQLNonNull(GraphQLString) },
    description: { type: GraphQLString },        // alias for showDescription (backwards compat)
    showDescription: { type: GraphQLString },
    runDescription: { type: GraphQLString },
    performanceDescription: { type: GraphQLString },
    performanceTypes: { type: GraphQLString },  // comma-separated
    duration: { type: GraphQLString },           // minutes as string
    date: { type: GraphQLString },               // ISO date or parseable date string
    time: { type: GraphQLString },               // e.g. "7:30 PM"
    startTime: { type: GraphQLString },          // e.g. "7:30 PM" — alias for time
    endTime: { type: GraphQLString },            // e.g. "9:00 PM" — used to infer duration
    venueName: { type: GraphQLString },
    stageName: { type: GraphQLString },          // e.g. "LuEsther Hall" — optional, creates named stage on venue
    runTitle: { type: GraphQLString },            // e.g. "Inwood Shakespeare Festival's Annual: King Lear"
    companyName: { type: GraphQLString },
    ticketUrl: { type: GraphQLString }
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
      errors: [] as string[]
    }

    // Resolve dataSource if provided
    let sourceId: string | undefined
    if (dataSourceId) {
      const ds = await DataSourceModel.findById(dataSourceId)
      if (ds) sourceId = ds._id.toString()
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
              duration = end > start ? end - start : (end + 1440) - start // handle midnight crossing
            }
          }

          show = await new ShowModel({
            title: titleClean,
            description: row.showDescription?.trim() || row.description?.trim() || '',
            performanceTypes: types,
            duration,
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
          const venueSlug = row.venueName.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
          let venue = await VenueModel.findOne({ slug: venueSlug })
          if (!venue) {
            venue = await new VenueModel({
              name: row.venueName.trim(),
              slug: venueSlug,
              address: 'TBD',
              city: 'NYC',
              state: 'NY',
              coordinates: { lat: 40.7128, lng: -74.0060 },
              submittedBy: ctx.user.id
            }).save()
          }
          venueIds = [venue._id.toString()]
          // Ensure venue has a default stage
          const defaultStage = await ensureDefaultStage(venue._id, ctx.user.id)

          // Find or create a named stage if provided
          if (row.stageName?.trim()) {
            const stageSlug = row.stageName.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
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
          const companySlug = row.companyName.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
          let company = await ProductionCompanyModel.findOne({ slug: companySlug })
          if (!company) {
            company = await new ProductionCompanyModel({
              name: row.companyName.trim(),
              slug: companySlug,
              submittedBy: ctx.user.id
            }).save()
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
          run = await new RunModel({
            show: show._id,
            ...(row.runTitle?.trim() && { title: row.runTitle.trim() }),
            ...(row.runDescription?.trim() && { description: row.runDescription.trim() }),
            productionCompany: companyId,
            venues: venueIds,
            ...(stageId && { stage: stageId }),
            submittedBy: ctx.user.id,
            ...(sourceId && { source: sourceId })
          }).save()
          result.runsCreated++
        }

        // 5. Create Performance (if date provided)
        if (row.date?.trim()) {
          if (venueIds.length === 0) {
            result.errors.push(`Row ${rowNum}: Cannot create performance without a venue`)
          } else {
            const perfDate = new Date(row.date.trim())
            if (isNaN(perfDate.getTime())) {
              result.errors.push(`Row ${rowNum}: Invalid date "${row.date}"`)
            } else {
              await new PerformanceModel({
                run: run._id,
                date: perfDate,
                time: row.time?.trim() || row.startTime?.trim() || '',
                venueId: venueIds[0],
                ticketUrl: row.ticketUrl?.trim() || '',
                ...(row.performanceDescription?.trim() && {
                  metadataOverrides: { description: row.performanceDescription.trim() }
                }),
                submittedBy: ctx.user.id,
                ...(sourceId && { source: sourceId })
              }).save()
              result.performancesCreated++

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

      } catch (err: any) {
        result.errors.push(`Row ${rowNum}: ${err.message || 'Unknown error'}`)
      }
    }

    return { result }
  }
})
