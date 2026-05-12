import { Types, HydratedDocument } from 'mongoose'
import { DataSourceModel, IDataSource } from '../../entities/dataSource/dataSourceModel'

type DataSourceDoc = HydratedDocument<IDataSource>
import { PerformanceModel } from '../../entities/performance/performanceModel'
import { VenueModel } from '../../entities/venue/venueModel'
import { RunModel } from '../../entities/run/runModel'
import { ShowModel } from '../../entities/show/showModel'
import { ensureDefaultStage } from '../../entities/stage/ensureDefaultStage'
import { parseFeed, ParsedEvent } from '../feedParser/parseFeed'
import { writeAuditLog } from '../auditLog/writeAuditLog'
import { createProposal } from '../../entities/proposal/mutations/createProposal'
import { createNotification } from '../notifications/createNotification'
import { detectConflict } from './detectConflict'

// Phase 6 sync executor.
//
// Reads one `claimant-sync` DataSource, fetches and parses its feed, then for
// each event resolves the matching record under the associated venue and
// applies it. Three outcomes per event:
//
//   1. No matching performance exists → create the Show/Run/Performance chain
//      and write an `_created` AuditLog row attributed to SyncFeed.
//   2. Matching performance exists and a field would change → call
//      detectConflict per-field. Auto-apply on no-conflict (writeAuditLog);
//      route to createProposal on conflict (a `sync_conflict_detected`
//      notification fires from the proposal create path).
//   3. Matching performance exists and no field would change → no-op.
//
// Only Performance-shaped fields are considered for now (time, ticketUrl,
// metadataOverrides.description, metadataOverrides.imageUrl). Field-level
// sync to Show/Run is out of scope for v1; the doc explicitly defers
// per-field mapping config.

export interface SyncResult {
  dataSourceId: string
  fetched: number
  created: number
  applied: number
  queued: number
  skipped: number
  errors: string[]
}

// Fields on Performance that this executor will sync. Kept narrow on purpose;
// adding fields here is a deliberate scope decision.
const SYNC_FIELDS = ['time', 'ticketUrl', 'description', 'imageUrl'] as const
type SyncField = typeof SYNC_FIELDS[number]

function projectPerformanceField(perf: any, field: SyncField): any {
  if (field === 'description') return perf?.metadataOverrides?.description ?? null
  if (field === 'imageUrl') return perf?.metadataOverrides?.imageUrl ?? null
  return perf?.[field] ?? null
}

function projectEventField(event: ParsedEvent, field: SyncField): any {
  if (field === 'description') return event.description ?? null
  if (field === 'imageUrl') return event.imageUrl ?? null
  if (field === 'ticketUrl') return event.ticketUrl ?? null
  if (field === 'time') return event.time ?? null
  return null
}

function setPerformanceField(perf: any, field: SyncField, value: any): void {
  if (field === 'description') {
    perf.metadataOverrides = { ...(perf.metadataOverrides ?? {}), description: value }
    return
  }
  if (field === 'imageUrl') {
    perf.metadataOverrides = { ...(perf.metadataOverrides ?? {}), imageUrl: value }
    return
  }
  perf[field] = value
}

function dayWindow(d: Date): { start: Date; end: Date } {
  const start = new Date(d)
  start.setHours(0, 0, 0, 0)
  const end = new Date(d)
  end.setHours(23, 59, 59, 999)
  return { start, end }
}

function labelForDataSource(ds: DataSourceDoc): string {
  const host = (() => {
    if (!ds.url) return null
    try { return new URL(ds.url).host } catch { return null }
  })()
  return host ? `Curtn (${host})` : `Curtn (${ds.name})`
}

async function resolveOrCreatePerformance(
  ds: DataSourceDoc,
  venueId: Types.ObjectId,
  event: ParsedEvent,
): Promise<{ created: boolean; performanceId: Types.ObjectId | null; error?: string }> {
  if (!event.date) return { created: false, performanceId: null, error: 'no-date' }

  // Find existing performance by (venue, date-day, show-title-ish).
  const titleRegex = new RegExp(`^${event.title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i')
  const show = await ShowModel.findOne({ title: titleRegex })
  if (show) {
    const { start, end } = dayWindow(event.date)
    const candidates = await PerformanceModel.find({
      venueId,
      date: { $gte: start, $lte: end },
    }).populate({ path: 'run', select: 'show' })
    const match = candidates.find(p => {
      const runShow = (p.run as any)?.show
      return runShow && runShow.toString() === show._id.toString()
    })
    if (match) return { created: false, performanceId: match._id }
  }

  // Create the Show → Run → Performance chain.
  const submittedBy = ds.createdBy
  let showDoc = show
  if (!showDoc) {
    showDoc = await new ShowModel({
      title: event.title,
      description: event.description ?? '',
      performanceTypes: [],
      duration: 0,
      ...(event.imageUrl && { imageUrl: event.imageUrl }),
      submittedBy,
      source: ds._id,
    }).save()
  }

  await ensureDefaultStage(venueId, submittedBy)

  let run = await RunModel.findOne({ show: showDoc._id, venues: venueId })
  if (!run) {
    run = await new RunModel({
      show: showDoc._id,
      venues: [venueId],
      ...(event.startDate && { startDate: event.startDate }),
      ...(event.endDate && { endDate: event.endDate }),
      submittedBy,
      source: ds._id,
    }).save()
  }

  const perf = await new PerformanceModel({
    run: run._id,
    date: event.date,
    ...(event.time && { time: event.time }),
    venueId,
    ticketUrl: event.ticketUrl ?? '',
    ...(event.description && { metadataOverrides: { description: event.description } }),
    submittedBy,
    source: ds._id,
  }).save()

  return { created: true, performanceId: perf._id }
}

async function applyOrQueueField(
  ds: DataSourceDoc,
  performanceId: Types.ObjectId,
  field: SyncField,
  oldValue: any,
  newValue: any,
  claimantId: Types.ObjectId | null,
): Promise<'applied' | 'queued' | 'skipped'> {
  const decision = await detectConflict({
    target: { kind: 'Performance', id: performanceId },
    field,
    dataSourceId: ds._id,
  })

  if (decision.conflict) {
    await createProposal({
      target: { kind: 'Performance', id: performanceId },
      proposer: {
        kind: 'SyncFeed',
        dataSourceId: ds._id,
        label: labelForDataSource(ds),
      },
      diff: { [field]: { old: oldValue, new: newValue } },
      submissionVersion: new Date(),
    })
    if (claimantId) {
      // Per scoping doc D6: digest in v1 simplified to one-per-conflict.
      // Tightening to true 24h-digest deferred.
      await createNotification({
        recipient: claimantId,
        kind: 'sync_conflict_detected',
        context: {
          dataSourceId: ds._id.toString(),
          dataSourceLabel: labelForDataSource(ds),
          targetKind: 'Performance',
          targetId: performanceId.toString(),
          field,
        },
      })
    }
    return 'queued'
  }

  // Auto-apply.
  const perf = await PerformanceModel.findById(performanceId)
  if (!perf) return 'skipped'
  const oldDoc = perf.toObject()
  setPerformanceField(perf, field, newValue)
  await perf.save()
  await writeAuditLog({
    target: { kind: 'Performance', id: perf._id },
    author: {
      kind: 'SyncFeed',
      dataSourceId: ds._id,
      label: labelForDataSource(ds),
    },
    oldDoc,
    newDoc: perf.toObject(),
    approvalSource: 'direct-publish',
    approvalContext: {
      syncSource: ds._id.toString(),
    },
  })
  return 'applied'
}

export async function runSync(
  dataSource: DataSourceDoc,
  opts: { now?: Date } = {},
): Promise<SyncResult> {
  const now = opts.now ?? new Date()
  const result: SyncResult = {
    dataSourceId: dataSource._id.toString(),
    fetched: 0,
    created: 0,
    applied: 0,
    queued: 0,
    skipped: 0,
    errors: [],
  }

  if (dataSource.purpose !== 'claimant-sync') {
    result.errors.push('runSync invoked on non-claimant-sync DataSource')
    return result
  }
  if (!dataSource.associatedVenue) {
    result.errors.push('claimant-sync DataSource has no associatedVenue')
    return result
  }
  if (dataSource.type !== 'rss' && dataSource.type !== 'ical') {
    result.errors.push(`unsupported sync feed type: ${dataSource.type}`)
    return result
  }
  if (!dataSource.url) {
    result.errors.push('missing feed URL')
    return result
  }

  const venue = await VenueModel.findById(dataSource.associatedVenue).select('claimedBy claimState')
  if (!venue) {
    result.errors.push('associated venue not found')
    return result
  }
  const claimantId = (venue.claimedBy as any) ?? null

  // Mark lastPolledAt up-front so concurrent crons don't double-fire even if
  // the parse below throws. The success path also bumps lastSuccessAt.
  await DataSourceModel.updateOne(
    { _id: dataSource._id },
    { $set: { lastPolledAt: now } },
  )

  let events: ParsedEvent[] = []
  try {
    events = await parseFeed(dataSource.type as 'rss' | 'ical', dataSource.url, dataSource.config || {})
  } catch (err: any) {
    result.errors.push(`parse failed: ${err?.message ?? String(err)}`)
    await DataSourceModel.updateOne(
      { _id: dataSource._id },
      { $inc: { consecutiveFailures: 1 } },
    )
    return result
  }

  result.fetched = events.length

  for (const event of events) {
    if (!event.title?.trim()) {
      result.skipped++
      continue
    }
    try {
      const resolved = await resolveOrCreatePerformance(dataSource, dataSource.associatedVenue as any, event)
      if (resolved.error || !resolved.performanceId) {
        result.skipped++
        continue
      }

      if (resolved.created) {
        // _created snapshot row.
        const perf = await PerformanceModel.findById(resolved.performanceId)
        if (perf) {
          await writeAuditLog({
            target: { kind: 'Performance', id: perf._id },
            author: {
              kind: 'SyncFeed',
              dataSourceId: dataSource._id,
              label: labelForDataSource(dataSource),
            },
            oldDoc: null,
            newDoc: perf.toObject(),
            approvalSource: 'direct-publish',
            approvalContext: { syncSource: dataSource._id.toString() },
          })
        }
        result.created++
        continue
      }

      // Existing performance — check each sync field for changes.
      const perf = await PerformanceModel.findById(resolved.performanceId)
      if (!perf) continue
      for (const field of SYNC_FIELDS) {
        const oldValue = projectPerformanceField(perf, field)
        const newValue = projectEventField(event, field)
        if (newValue == null) continue
        if (oldValue === newValue) continue
        const outcome = await applyOrQueueField(
          dataSource,
          perf._id,
          field,
          oldValue,
          newValue,
          claimantId,
        )
        if (outcome === 'applied') result.applied++
        else if (outcome === 'queued') result.queued++
        else result.skipped++
      }
    } catch (err: any) {
      result.errors.push(`event "${event.title}": ${err?.message ?? String(err)}`)
    }
  }

  // Successful poll — clear failures + mark health.
  await DataSourceModel.updateOne(
    { _id: dataSource._id },
    {
      $set: {
        lastSuccessAt: now,
        consecutiveFailures: 0,
        healthStatus: 'healthy',
      },
    },
  )

  // Recovery — if the venue had been marked stale and a successful poll just
  // landed, transition back to healthy and notify. The cron also covers this
  // path on its daily cadence, but doing it here keeps the UI immediately
  // accurate for the next dashboard refresh.
  if (dataSource.associatedVenue) {
    const v = await VenueModel.findById(dataSource.associatedVenue).select('syncHealth claimedBy')
    if (v?.syncHealth === 'stale') {
      await VenueModel.updateOne(
        { _id: v._id },
        { $set: { syncHealth: 'healthy' } },
      )
      if (v.claimedBy) {
        await createNotification({
          recipient: v.claimedBy,
          kind: 'sync_recovered',
          context: {
            dataSourceId: dataSource._id.toString(),
            targetKind: 'venue',
            targetId: v._id.toString(),
          },
        })
      }
    }
  }

  return result
}
