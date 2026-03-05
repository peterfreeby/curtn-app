import mongoose, { Schema, Types } from 'mongoose'

export interface IFollow {
  follower: Types.ObjectId,
  following: Types.ObjectId,
}

const schema = new Schema<IFollow>({
  follower: {
    type: Schema.Types.ObjectId,
    ref: 'user',
    required: true
  },
  following: {
    type: Schema.Types.ObjectId,
    ref: 'user',
    required: true
  }
}, {
  timestamps: true
})

// Prevent duplicate follows
schema.index({ follower: 1, following: 1 }, { unique: true })
// Efficient queries: "who does this user follow?" sorted by recency
schema.index({ follower: 1, createdAt: -1 })
// Efficient queries: "who follows this user?" sorted by recency
schema.index({ following: 1, createdAt: -1 })

export const FollowModel = (mongoose.models.follow as mongoose.Model<IFollow>) || mongoose.model<IFollow>('follow', schema)
