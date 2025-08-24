import mongoose, { ObjectId, Schema, Types } from 'mongoose'

export interface IReview {
  user: ObjectId,
  performance: Types.ObjectId, // Reference to Performance document
  performanceDate: Date, // Which specific showing they attended
  venue: string, // Which venue (for touring shows)
  text: string,
  rating: number,
  attendedAt: Date, // When they actually saw it (same as performanceDate usually)
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
  performanceDate: {
    type: Date,
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
  timestamps: true // Adds createdAt and updatedAt automatically
})

// Indexes for efficient querying
schema.index({ performance: 1, performanceDate: 1 }) // Reviews for specific performance dates
schema.index({ user: 1, createdAt: -1 }) // User's reviews chronologically
schema.index({ performance: 1, createdAt: -1 }) // Recent reviews for a performance
schema.index({ rating: 1 }) // Filter by rating
schema.index({ venue: 1, performanceDate: 1 }) // Reviews by venue and date

// Ensure one review per user per performance date (prevent duplicate reviews)
schema.index({ user: 1, performance: 1, performanceDate: 1 }, { unique: true })

export const ReviewModel = mongoose.model<IReview>('review', schema)