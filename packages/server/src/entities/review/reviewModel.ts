import mongoose, { ObjectId, Schema, Types } from 'mongoose'

export interface IReview {
  user: ObjectId,
  performance: Types.ObjectId,
  run: Types.ObjectId,
  venue: string,
  text: string,
  rating: number,
  attendedAt: Date,
  comments: Types.ObjectId[],
}

const schema = new Schema<IReview>({
  user: {
    type: Schema.Types.ObjectId,
    ref: 'user',
    required: true
  },
  performance: {
    type: Schema.Types.ObjectId,
    ref: 'performance',
    required: true
  },
  run: {
    type: Schema.Types.ObjectId,
    ref: 'run',
    required: true
  },
  venue: {
    type: String,
    required: true
  },
  text: {
    type: String,
    trim: true
  },
  rating: {
    type: Number,
    min: 0,
    max: 5,
    required: true
  },
  attendedAt: {
    type: Date,
    required: true
  },
  comments: [{
    type: Schema.Types.ObjectId,
    ref: 'comment'
  }]
}, {
  timestamps: true
})

schema.index({ performance: 1 })
schema.index({ run: 1, createdAt: -1 })
schema.index({ user: 1, createdAt: -1 })
schema.index({ rating: 1 })
schema.index({ venue: 1 })
schema.index({ user: 1, performance: 1 }, { unique: true })

export const ReviewModel = (mongoose.models.review as mongoose.Model<IReview>) || mongoose.model<IReview>('review', schema)
