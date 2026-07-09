import { Types } from 'mongoose'
import { VenueModel } from '../venueModel'
import { RunModel } from '../../run/runModel'
import { PerformanceModel } from '../../performance/performanceModel'
import { DataSourceModel } from '../../dataSource/dataSourceModel'
import { StageModel } from '../../stage/stageModel'

export interface MergeVenueResult {
  ok: boolean
  error?: string
  deletedId?: string
}

// Core venue-merge logic, shared by the admin GraphQL mutation and the
// bulk address-cleanup script. Reassigns every reference from `source` onto
// `target`, then deletes the source venue. Callers are responsible for
// authorization (the GraphQL mutation checks admin; scripts run trusted).
export async function mergeVenueCore(
  sourceId: string | Types.ObjectId,
  targetId: string | Types.ObjectId
): Promise<MergeVenueResult> {
  if (String(sourceId) === String(targetId)) {
    return { ok: false, error: 'Cannot merge a venue into itself' }
  }

  const source = await VenueModel.findById(sourceId)
  const target = await VenueModel.findById(targetId)
  if (!source) return { ok: false, error: 'Source venue not found' }
  if (!target) return { ok: false, error: 'Target venue not found' }

  // Reassign performances
  await PerformanceModel.updateMany({ venueId: source._id }, { venueId: target._id })

  // Reassign runs: replace source venue ID with target in the venues array
  await RunModel.updateMany(
    { venues: source._id },
    { $addToSet: { venues: target._id } }
  )
  await RunModel.updateMany(
    { venues: source._id },
    { $pull: { venues: source._id } }
  )

  // Reassign data sources
  await DataSourceModel.updateMany({ defaultVenue: source._id }, { defaultVenue: target._id })

  // Move stages to target venue, handling slug collisions.
  // Stages have a unique { slug, venue } index. For each source stage whose slug
  // already exists on target, repoint stageOverride references and delete the source stage.
  const sourceStages = await StageModel.find({ venue: source._id })
  const targetStages = await StageModel.find({ venue: target._id })
  const targetSlugMap = new Map(targetStages.map(s => [s.slug, s._id]))

  for (const sourceStage of sourceStages) {
    const collidingTargetId = targetSlugMap.get(sourceStage.slug)
    if (collidingTargetId) {
      await PerformanceModel.updateMany(
        { stageOverride: sourceStage._id },
        { stageOverride: collidingTargetId }
      )
      await RunModel.updateMany(
        { stage: sourceStage._id },
        { stage: collidingTargetId }
      )
      await StageModel.findByIdAndDelete(sourceStage._id)
    } else {
      await StageModel.updateOne({ _id: sourceStage._id }, { venue: target._id })
    }
  }

  // Delete source venue
  await VenueModel.findByIdAndDelete(source._id)

  return { ok: true, deletedId: String(source._id) }
}
