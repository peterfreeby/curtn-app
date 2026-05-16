import { ShowModel } from '../../entities/show/showModel'
import { RunModel } from '../../entities/run/runModel'
import { PerformanceModel } from '../../entities/performance/performanceModel'
import { VenueModel } from '../../entities/venue/venueModel'
import { ProductionCompanyModel } from '../../entities/productionCompany/productionCompanyModel'
import { DataSourceModel } from '../../entities/dataSource/dataSourceModel'
import { ensureDefaultStage } from '../../entities/stage/ensureDefaultStage'
import { StageModel } from '../../entities/stage/stageModel'
import { PersonModel } from '../../entities/person/personModel'
import { CreditModel } from '../../entities/credit/creditModel'
import { ShowCreditModel } from '../../entities/showCredit/showCreditModel'
import { ListModel, LIST_TYPES } from '../../entities/list/listModel'
import { ListItemModel } from '../../entities/list/listItemModel'
import {
  typeImpliesVariableLineup,
  resolvePerformanceTypes,
  isCleanLineupBreak
} from './lineupHeuristics'

// --- Types ---

export interface CsvRowInput {
  title: string
  showDescription?: string
  performanceTypes?: string
  duration?: string
  showUrl?: string
  showImageUrl?: string
  showPosterUrl?: string
  languages?: string
  venueName?: string
  stageName?: string
  venueDescription?: string
  venueAddress?: string
  venueCity?: string
  venueState?: string
  venueZipCode?: string
  venueCapacity?: string
  venueType?: string
  venueWebsite?: string
  venuePhone?: string
  venueEmail?: string
  venueImageUrl?: string
  runTitle?: string
  runDescription?: string
  runStartDate?: string
  runEndDate?: string
  intermissions?: string
  runImageUrl?: string
  runPosterUrl?: string
  date?: string
  time?: string
  startTime?: string
  endTime?: string
  ticketUrl?: string
  performanceDescription?: string
  soldOut?: string
  companyName?: string
  companyDescription?: string
  companyLogoUrl?: string
  performanceImageUrl?: string
  personHeadshotUrl?: string
  personName?: string
  personRole?: string
  creditType?: string
  creditDepartment?: string
  listName?: string
  listType?: string
  listDescription?: string
  listItemNote?: string
}

export interface ImportResult {
  totalRows: number
  showsCreated: number
  showsMatched: number
  runsCreated: number
  runsMatched: number
  performancesCreated: number
  performancesMatched: number
  venuesCreated: number
  venuesMatched: number
  companiesCreated: number
  companiesMatched: number
  personsCreated: number
  personsMatched: number
  creditsCreated: number
  listsCreated: number
  listsMatched: number
  listItemsAdded: number
  errors: string[]
}

// --- Constants ---

const VALID_PERFORMANCE_TYPES = new Set([
  'theater', 'play', 'musical', 'dance', 'comedy', 'improv',
  'spoken-word', 'cabaret', 'experimental', 'immersive',
  'drag', 'burlesque', 'happening', 'other'
])

const PERFORMANCE_TYPE_ALIASES: Record<string, string> = {
  'theatre': 'theater',
  'drama': 'play',
  'stand-up': 'comedy',
  'standup': 'comedy',
  'stand up': 'comedy',
  'spoken word': 'spoken-word',
  'spokenword': 'spoken-word',
  'variety': 'cabaret',
  'performance art': 'experimental',
  'site-specific': 'immersive',
  'opera': 'musical',
  'sketch': 'comedy',
}

// --- Helpers ---

function normalizePerformanceType(raw: string): string | null {
  const lower = raw.trim().toLowerCase()
  if (VALID_PERFORMANCE_TYPES.has(lower)) return lower
  if (PERFORMANCE_TYPE_ALIASES[lower]) return PERFORMANCE_TYPE_ALIASES[lower]
  return null
}

function parseTimeToMinutes(timeStr: string): number | null {
  const match24 = timeStr.match(/^(\d{1,2}):(\d{2})$/)
  if (match24) {
    return parseInt(match24[1], 10) * 60 + parseInt(match24[2], 10)
  }
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

const toSlug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')

const parseSoldOut = (val?: string): boolean => {
  if (!val) return false
  const v = val.trim().toLowerCase()
  return ['true', 'yes', '1', 'sold out', 'soldout'].includes(v)
}

// --- Main Engine ---

export async function processImportRows(
  rows: CsvRowInput[],
  ctx: { userId: string; dataSourceId?: string },
  options?: { dryRun?: boolean }
): Promise<ImportResult> {
  const dryRun = options?.dryRun || false

  const result: ImportResult = {
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
    listsCreated: 0,
    listsMatched: 0,
    listItemsAdded: 0,
    errors: []
  }

  let sourceId: string | undefined
  if (ctx.dataSourceId) {
    const ds = await DataSourceModel.findById(ctx.dataSourceId)
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
      let showJustCreated = false

      if (show) {
        result.showsMatched++
        if (!dryRun) {
          const imageUpdates: Record<string, string> = {}
          if (row.showImageUrl?.trim() && !show.imageUrl) {
            imageUpdates.imageUrl = row.showImageUrl.trim()
          }
          if (row.showPosterUrl?.trim() && !show.posterUrl) {
            imageUpdates.posterUrl = row.showPosterUrl.trim()
          }
          if (Object.keys(imageUpdates).length > 0) {
            Object.assign(show, imageUpdates)
            await show.save()
          }
        }
      } else {
        if (dryRun) {
          result.showsCreated++
          continue
        }
        const types = row.performanceTypes
          ? row.performanceTypes.split(',').map(t => normalizePerformanceType(t)).filter(Boolean) as string[]
          : []
        let duration = row.duration ? parseInt(row.duration, 10) || 0 : 0
        if (!duration && row.startTime?.trim() && row.endTime?.trim()) {
          const start = parseTimeToMinutes(row.startTime.trim())
          const end = parseTimeToMinutes(row.endTime.trim())
          if (start !== null && end !== null) {
            duration = end > start ? end - start : (end + 1440) - start
          }
        }

        const langs = row.languages
          ? row.languages.split(',').map(l => l.trim()).filter(Boolean)
          : ['English']

        show = await new ShowModel({
          title: titleClean,
          description: row.showDescription?.trim() || '',
          performanceTypes: types,
          duration,
          languages: langs,
          ...(row.showUrl?.trim() && { url: row.showUrl.trim() }),
          ...(row.showImageUrl?.trim() && { imageUrl: row.showImageUrl.trim() }),
          ...(row.showPosterUrl?.trim() && { posterUrl: row.showPosterUrl.trim() }),
          submittedBy: ctx.userId,
          ...(sourceId && { source: sourceId })
        }).save()
        result.showsCreated++
        showJustCreated = true
      }

      if (dryRun) continue

      // 2. Find or create Venue + Stage
      let venueIds: string[] = []
      let stageId: string | undefined
      let resolvedVenue: any = null
      if (row.venueName?.trim()) {
        const venueSlug = toSlug(row.venueName.trim())
        let venue = await VenueModel.findOne({ slug: venueSlug })
        if (!venue) {
          venue = await new VenueModel({
            name: row.venueName.trim(),
            slug: venueSlug,
            ...(row.venueAddress?.trim() && { address: row.venueAddress.trim() }),
            ...(row.venueCity?.trim() && { city: row.venueCity.trim() }),
            ...(row.venueState?.trim() && { state: row.venueState.trim() }),
            ...(row.venueDescription?.trim() && { description: row.venueDescription.trim() }),
            ...(row.venueZipCode?.trim() && { zipCode: row.venueZipCode.trim() }),
            ...(row.venueCapacity?.trim() && { capacity: parseInt(row.venueCapacity, 10) || undefined }),
            ...(row.venueType?.trim() && { venueType: row.venueType.trim().toLowerCase() }),
            ...(row.venueWebsite?.trim() && { website: row.venueWebsite.trim() }),
            ...(row.venuePhone?.trim() && { phone: row.venuePhone.trim() }),
            ...(row.venueEmail?.trim() && { email: row.venueEmail.trim() }),
            ...(row.venueImageUrl?.trim() && { imageUrl: row.venueImageUrl.trim() }),
            submittedBy: ctx.userId
          }).save()
          result.venuesCreated++
        } else {
          result.venuesMatched++
        }
        resolvedVenue = venue
        venueIds = [venue._id.toString()]
        const defaultStage = await ensureDefaultStage(venue._id, ctx.userId as any)

        if (row.stageName?.trim()) {
          const stageSlug = toSlug(row.stageName.trim())
          let stage = await StageModel.findOne({ venue: venue._id, slug: stageSlug })
          if (!stage) {
            stage = await new StageModel({
              name: row.stageName.trim(),
              slug: stageSlug,
              venue: venue._id,
              isDefault: false,
              submittedBy: ctx.userId
            }).save()
          }
          stageId = stage._id.toString()
        } else {
          stageId = defaultStage._id.toString()
        }
      }

      // 2b. Venue default performance type — fallback only (never overrides
      // an explicitly-typed row). Backfill a just-created Show left untyped.
      // See [[Venue Default Performance Type]].
      const venueDefaultType: string | undefined = resolvedVenue?.defaultPerformanceType
      const rowTypes = row.performanceTypes
        ? row.performanceTypes.split(',').map(t => normalizePerformanceType(t)).filter(Boolean) as string[]
        : []
      const effectiveTypes = resolvePerformanceTypes(rowTypes, venueDefaultType)
      if (showJustCreated && (!show.performanceTypes || show.performanceTypes.length === 0) && effectiveTypes.length) {
        show.performanceTypes = effectiveTypes as any
        await show.save()
      }

      // 3. Find or create ProductionCompany
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
            submittedBy: ctx.userId
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
        const runStartDate = row.runStartDate?.trim() ? new Date(row.runStartDate.trim()) : undefined
        const runEndDate = row.runEndDate?.trim() ? new Date(row.runEndDate.trim()) : undefined

        run = await new RunModel({
          show: show._id,
          ...(row.runTitle?.trim() && { title: row.runTitle.trim() }),
          ...(row.runDescription?.trim() && { description: row.runDescription.trim() }),
          productionCompany: companyId,
          venues: venueIds,
          ...(stageId && { stage: stageId }),
          // Type prior (see lineupHeuristics + [[Per-Performance Cast Attribution]]).
          lineupPerPerformance: typeImpliesVariableLineup(effectiveTypes, venueDefaultType),
          ...(row.intermissions?.trim() && { intermissions: parseInt(row.intermissions, 10) || 0 }),
          ...(runStartDate && !isNaN(runStartDate.getTime()) && { startDate: runStartDate }),
          ...(runEndDate && !isNaN(runEndDate.getTime()) && { endDate: runEndDate }),
          ...(row.runImageUrl?.trim() && { imageUrl: row.runImageUrl.trim() }),
          ...(row.runPosterUrl?.trim() && { posterUrl: row.runPosterUrl.trim() }),
          submittedBy: ctx.userId,
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
                ...(row.performanceImageUrl?.trim() && { imageUrl: row.performanceImageUrl.trim() }),
                submittedBy: ctx.userId,
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
      if (row.personName?.trim() && row.personRole?.trim()) {
        const personSlug = toSlug(row.personName.trim())
        let person = await PersonModel.findOne({ slug: personSlug })
        if (!person) {
          person = await new PersonModel({
            name: row.personName.trim(),
            slug: personSlug,
            ...(row.personHeadshotUrl?.trim() && { headshotUrl: row.personHeadshotUrl.trim() }),
            submittedBy: ctx.userId
          }).save()
          result.personsCreated++
        } else {
          result.personsMatched++
          // Backfill headshot if missing
          if (row.personHeadshotUrl?.trim() && !person.headshotUrl) {
            person.headshotUrl = row.personHeadshotUrl.trim()
            await person.save()
          }
        }

        const creditTypeRaw = (row.creditType || row.creditDepartment || 'cast').trim().toLowerCase()
        const isCreator = creditTypeRaw === 'creator' || creditTypeRaw === 'creative'
        const hasPerformanceContext = !!(row.date?.trim() && performance)
        const hasRunContext = !!(row.venueName?.trim() || row.runTitle?.trim() || row.companyName?.trim())

        if (isCreator || (!hasRunContext && !hasPerformanceContext)) {
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
              submittedBy: ctx.userId
            }).save()
            result.creditsCreated++
          }
        } else if (hasPerformanceContext && performance) {
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
              submittedBy: ctx.userId
            }).save()
            result.creditsCreated++
          }
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
              submittedBy: ctx.userId
            }).save()
            result.creditsCreated++
          }
        }
      }

      // 7. Add to List (if listName provided)
      if (row.listName?.trim()) {
        const listTypeRaw = (row.listType || 'shows').trim().toLowerCase()
        if (!LIST_TYPES.includes(listTypeRaw as any)) {
          result.errors.push(`Row ${rowNum}: Invalid list type "${listTypeRaw}". Must be one of: ${LIST_TYPES.join(', ')}`)
        } else {
          let targetItemId: string | null = null
          if (listTypeRaw === 'shows' && show) {
            targetItemId = show._id.toString()
          } else if (listTypeRaw === 'venues' && venueIds.length > 0) {
            targetItemId = venueIds[0]
          } else if (listTypeRaw === 'runs' && run) {
            targetItemId = run._id.toString()
          } else if (listTypeRaw === 'performances' && performance) {
            targetItemId = performance._id.toString()
          } else if (listTypeRaw === 'people') {
            if (row.personName?.trim()) {
              const personSlug = toSlug(row.personName.trim())
              const person = await PersonModel.findOne({ slug: personSlug })
              if (person) targetItemId = person._id.toString()
            }
          }

          if (!targetItemId) {
            result.errors.push(`Row ${rowNum}: No matching ${listTypeRaw.slice(0, -1)} found to add to list "${row.listName.trim()}"`)
          } else {
            const listNameClean = row.listName.trim()
            const listSlug = toSlug(listNameClean)
            let list = await ListModel.findOne({ slug: listSlug, owner: ctx.userId, listType: listTypeRaw })

            if (list) {
              result.listsMatched++
            } else {
              if (!dryRun) {
                let finalSlug = listSlug
                let suffix = 1
                while (await ListModel.findOne({ slug: finalSlug, owner: ctx.userId })) {
                  suffix++
                  finalSlug = `${listSlug}-${suffix}`
                }
                list = await new ListModel({
                  name: listNameClean,
                  slug: finalSlug,
                  description: row.listDescription?.trim() || '',
                  listType: listTypeRaw,
                  isPublic: true,
                  isEditorial: true,
                  owner: ctx.userId
                }).save()
              }
              result.listsCreated++
            }

            if (!dryRun && list) {
              const existing = await ListItemModel.findOne({ list: list._id, itemId: targetItemId })
              if (!existing) {
                const maxPos = await ListItemModel.findOne({ list: list._id }).sort({ position: -1 })
                const position = maxPos ? maxPos.position + 1 : 0

                await ListItemModel.create({
                  list: list._id,
                  itemId: targetItemId,
                  position,
                  addedBy: ctx.userId,
                  ...(row.listItemNote?.trim() && { note: row.listItemNote.trim() })
                })

                await ListModel.findByIdAndUpdate(list._id, { $inc: { itemCount: 1 } })
                result.listItemsAdded++
              }
            }
          }
        }
      }

    } catch (err: any) {
      result.errors.push(`Row ${rowNum}: ${err.message || 'Unknown error'}`)
    }
  }

  return result
}
