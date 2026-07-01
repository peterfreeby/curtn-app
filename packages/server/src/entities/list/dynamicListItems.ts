import { Types } from 'mongoose'
import { RunModel } from '../run/runModel'
import { CreditModel } from '../credit/creditModel'
import { PerformanceModel } from '../performance/performanceModel'
import { ShowModel } from '../show/showModel'
import { ListSourceEntityType } from './listModel'

// Cap how many runs we'll fan out over for a single dynamic list, to bound work
// for prolific venues/companies. Flagged as a denormalization candidate if it bites.
const MAX_RUNS = 2000
// Default number of shows surfaced in a browse carousel.
export const DEFAULT_DYNAMIC_LIMIT = 24

interface RunRef {
  _id: Types.ObjectId
  show?: Types.ObjectId
  startDate?: Date
  createdAt?: Date
}

/**
 * Resolve the runs relevant to a set of source entities of one type.
 * Returns lightweight run refs carrying the show id + fallback recency fields.
 */
async function runsForEntities (
  targetType: ListSourceEntityType,
  targetIds: Types.ObjectId[]
): Promise<RunRef[]> {
  if (targetIds.length === 0) return []

  if (targetType === 'venue') {
    return RunModel.find({ venues: { $in: targetIds } })
      .select('_id show startDate createdAt')
      .limit(MAX_RUNS)
      .lean() as unknown as RunRef[]
  }

  if (targetType === 'productionCompany') {
    return RunModel.find({ productionCompany: { $in: targetIds } })
      .select('_id show startDate createdAt')
      .limit(MAX_RUNS)
      .lean() as unknown as RunRef[]
  }

  // person → credits → runs
  const runIds = await CreditModel.distinct('run', { person: { $in: targetIds } })
  if (runIds.length === 0) return []
  return RunModel.find({ _id: { $in: runIds } })
    .select('_id show startDate createdAt')
    .limit(MAX_RUNS)
    .lean() as unknown as RunRef[]
}

/**
 * Returns show documents for the given source entities, sorted by most recent
 * performance date (descending). Each show carries `id` (so the GraphQL
 * globalIdField resolves) and `_listType = 'shows'` (so the ListableItem union
 * resolves its type). Falls back to run start/created date when a run has no
 * performances yet, so freshly-added shows still appear.
 */
export async function showsForEntities (
  targetType: ListSourceEntityType,
  targetIds: Types.ObjectId[],
  limit: number = DEFAULT_DYNAMIC_LIMIT
): Promise<any[]> {
  const runs = await runsForEntities(targetType, targetIds)
  if (runs.length === 0) return []

  const runIds = runs.map(r => r._id)

  // Max performance date per run.
  const perfAgg: Array<{ _id: Types.ObjectId, lastDate: Date }> = await PerformanceModel.aggregate([
    { $match: { run: { $in: runIds } } },
    { $group: { _id: '$run', lastDate: { $max: '$date' } } }
  ])
  const perfByRun = new Map<string, Date>()
  for (const row of perfAgg) perfByRun.set(row._id.toString(), row.lastDate)

  // Fold runs into shows, taking the most recent effective date per show.
  const showDate = new Map<string, number>()
  for (const run of runs) {
    if (!run.show) continue
    const showId = run.show.toString()
    const effective = perfByRun.get(run._id.toString()) ?? run.startDate ?? run.createdAt
    if (!effective) continue
    const ts = new Date(effective).getTime()
    const prev = showDate.get(showId)
    if (prev === undefined || ts > prev) showDate.set(showId, ts)
  }

  const ordered = [...showDate.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([showId]) => showId)

  if (ordered.length === 0) return []

  const showDocs = await ShowModel.find({ _id: { $in: ordered.map(id => new Types.ObjectId(id)) } }).lean()
  const byId = new Map<string, any>(showDocs.map(s => [s._id.toString(), s]))

  // Preserve recency order and shape for GraphQL.
  return ordered
    .map(id => byId.get(id))
    .filter(Boolean)
    .map(show => ({ ...show, id: show._id.toString(), _listType: 'shows' }))
}
