import mongoose, { Schema, Types } from 'mongoose'

export interface ISeen {
  user: Types.ObjectId
  run: Types.ObjectId
  show: Types.ObjectId
  createdAt: Date
  updatedAt: Date
}

const schema = new Schema<ISeen>({
  user: {
    type: Schema.Types.ObjectId,
    ref: 'user',
    required: true
  },
  run: {
    type: Schema.Types.ObjectId,
    ref: 'run',
    required: true
  },
  show: {
    type: Schema.Types.ObjectId,
    ref: 'show',
    required: true
  }
}, {
  timestamps: true
})

// One seen-mark per run per user
schema.index({ user: 1, run: 1 }, { unique: true })
// Profile history sorted by recency
schema.index({ user: 1, createdAt: -1 })
// "X people have seen this" counts
schema.index({ run: 1 })
// Show-level seen counts
schema.index({ show: 1 })

export const SeenModel = (mongoose.models.seen as mongoose.Model<ISeen>) || mongoose.model<ISeen>('seen', schema)
