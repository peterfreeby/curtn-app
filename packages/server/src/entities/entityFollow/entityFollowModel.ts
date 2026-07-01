import mongoose, { Schema, Types } from 'mongoose'

export const ENTITY_FOLLOW_TARGET_TYPES = ['venue', 'person', 'productionCompany'] as const
export type EntityFollowTargetType = typeof ENTITY_FOLLOW_TARGET_TYPES[number]

export interface IEntityFollow {
  follower: Types.ObjectId,
  targetType: EntityFollowTargetType,
  targetId: Types.ObjectId,
}

const schema = new Schema<IEntityFollow>({
  follower: {
    type: Schema.Types.ObjectId,
    ref: 'user',
    required: true
  },
  targetType: {
    type: String,
    enum: ENTITY_FOLLOW_TARGET_TYPES,
    required: true
  },
  targetId: {
    type: Schema.Types.ObjectId,
    required: true
  }
}, {
  timestamps: true
})

// Prevent duplicate follows of the same entity
schema.index({ follower: 1, targetType: 1, targetId: 1 }, { unique: true })
// "what entities of this type does this user follow?" sorted by recency
schema.index({ follower: 1, targetType: 1, createdAt: -1 })
// "who follows this entity?"
schema.index({ targetType: 1, targetId: 1 })

export const EntityFollowModel = (mongoose.models.entityFollow as mongoose.Model<IEntityFollow>) || mongoose.model<IEntityFollow>('entityFollow', schema)
