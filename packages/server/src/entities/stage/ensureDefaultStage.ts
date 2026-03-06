import { Types } from 'mongoose'
import { StageModel } from './stageModel'

/**
 * Ensures a venue has a default stage. Returns the default stage.
 * Call this when creating a venue or when a stage is needed but none exists.
 */
export async function ensureDefaultStage(venueId: Types.ObjectId, submittedBy: Types.ObjectId) {
  let defaultStage = await StageModel.findOne({ venue: venueId, isDefault: true })
  if (!defaultStage) {
    defaultStage = await StageModel.create({
      name: 'Default',
      slug: 'default',
      venue: venueId,
      isDefault: true,
      submittedBy
    })
  }
  return defaultStage
}
