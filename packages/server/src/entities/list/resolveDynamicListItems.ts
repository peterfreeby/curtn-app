import { Types } from 'mongoose'
import { EntityFollowModel } from '../entityFollow/entityFollowModel'
import { showsForEntities, DEFAULT_DYNAMIC_LIMIT } from './dynamicListItems'
import { computeDateWindow } from './dateWindows'

/**
 * Resolves the show documents for a dynamic list.
 *  - entity:   shows from the single configured source entity
 *  - follows:  shows from every entity of `followTargetType` the viewer follows
 *  - combined: the union of other show lists, filtered to `dateWindow` and
 *              ordered by soonest upcoming performance
 * Returns [] when the source is unset or (for follows) the viewer follows nothing,
 * which causes the list to disappear from the browse page.
 */
export async function resolveDynamicListItems (list: any, ctx: any): Promise<any[]> {
  if (list.sourceMode === 'entity') {
    if (!list.sourceEntityType || !list.sourceEntityId) return []
    return showsForEntities(list.sourceEntityType, [list.sourceEntityId], DEFAULT_DYNAMIC_LIMIT)
  }

  if (list.sourceMode === 'follows') {
    if (!list.followTargetType || !ctx?.user) return []
    const follows = await EntityFollowModel.find({
      follower: ctx.user.id,
      targetType: list.followTargetType
    }).select('targetId').lean()
    const targetIds = follows.map((f: any) => f.targetId as Types.ObjectId)
    if (targetIds.length === 0) return []
    return showsForEntities(list.followTargetType, targetIds, DEFAULT_DYNAMIC_LIMIT)
  }

  if (list.sourceMode === 'combined') {
    return resolveCombinedListItems(list, ctx)
  }

  return []
}

/**
 * Resolve one source list to its show docs. Source lists are always show-type
 * (enforced at create), so a manual list's items are show refs. Nested combined
 * lists are skipped to keep resolution one level deep.
 */
async function showsForSourceList (list: any, ctx: any): Promise<any[]> {
  if (list.sourceMode === 'entity' || list.sourceMode === 'follows') {
    return resolveDynamicListItems(list, ctx)
  }
  if (list.sourceMode === 'combined') {
    return [] // don't recurse into other combined lists
  }
  // manual: gather this list's show items
  const { ListItemModel } = require('./listItemModel')
  const { ShowModel } = require('../show/showModel')
  const items = await ListItemModel.find({ list: list._id }).select('itemId').lean()
  const showIds = items.map((i: any) => i.itemId).filter(Boolean)
  if (showIds.length === 0) return []
  const docs = await ShowModel.find({ _id: { $in: showIds } }).lean()
  return docs.map((s: any) => ({ ...s, id: s._id.toString(), _listType: 'shows' }))
}

async function resolveCombinedListItems (list: any, ctx: any): Promise<any[]> {
  const sourceIds: Types.ObjectId[] = list.sourceListIds ?? []
  if (sourceIds.length === 0 || !list.dateWindow) return []

  const { ListModel } = require('./listModel')
  const sources = await ListModel.find({ _id: { $in: sourceIds } }).lean()
  if (sources.length === 0) return []

  // Resolve each source to its shows, then union + dedupe by show id.
  const resolved = await Promise.all(sources.map((s: any) => showsForSourceList(s, ctx)))
  const byShowId = new Map<string, any>()
  for (const shows of resolved) {
    for (const show of shows) byShowId.set(show._id.toString(), show)
  }
  if (byShowId.size === 0) return []

  const { start, end } = computeDateWindow(list.dateWindow)

  // Keep only shows with a performance inside the window, ordered by soonest.
  const { RunModel } = require('../run/runModel')
  const { PerformanceModel } = require('../performance/performanceModel')

  const showObjectIds = [...byShowId.keys()].map(id => new Types.ObjectId(id))
  const runs = await RunModel.find({ show: { $in: showObjectIds } })
    .select('_id show')
    .lean()
  if (runs.length === 0) return []

  const runToShow = new Map<string, string>()
  for (const run of runs) {
    if (run.show) runToShow.set(run._id.toString(), run.show.toString())
  }

  const perfAgg: Array<{ _id: Types.ObjectId, soonest: Date }> = await PerformanceModel.aggregate([
    { $match: { run: { $in: runs.map((r: any) => r._id) }, date: { $gte: start, $lt: end } } },
    { $group: { _id: '$run', soonest: { $min: '$date' } } }
  ])

  // Fold runs into shows, taking the soonest in-window performance per show.
  const showSoonest = new Map<string, number>()
  for (const row of perfAgg) {
    const showId = runToShow.get(row._id.toString())
    if (!showId) continue
    const ts = new Date(row.soonest).getTime()
    const prev = showSoonest.get(showId)
    if (prev === undefined || ts < prev) showSoonest.set(showId, ts)
  }

  return [...showSoonest.entries()]
    .sort((a, b) => a[1] - b[1]) // soonest first
    .slice(0, DEFAULT_DYNAMIC_LIMIT)
    .map(([showId]) => byShowId.get(showId))
    .filter(Boolean)
}
