import mongoose, { Schema, Types } from 'mongoose'

export type GeocodingJobStatus = 'pending' | 'processing' | 'completed' | 'failed'

export interface IGeocodingJob {
  venueId: Types.ObjectId
  status: GeocodingJobStatus

  addressSnapshot: {
    address?: string
    city?: string
    state?: string
    zipCode?: string
  }

  attemptCount: number
  lastAttemptAt?: Date
  nextAttemptAt: Date
  lastError?: string

  createdAt: Date
  updatedAt: Date
  completedAt?: Date
}

const geocodingJobSchema = new Schema<IGeocodingJob>({
  venueId: {
    type: Schema.Types.ObjectId,
    ref: 'venue',
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'processing', 'completed', 'failed'],
    default: 'pending',
    required: true
  },
  addressSnapshot: {
    address: String,
    city: String,
    state: String,
    zipCode: String
  },
  attemptCount: {
    type: Number,
    default: 0,
    min: 0
  },
  lastAttemptAt: Date,
  nextAttemptAt: {
    type: Date,
    default: () => new Date(),
    required: true
  },
  lastError: String,
  completedAt: Date
}, {
  timestamps: true
})

geocodingJobSchema.index({ status: 1, nextAttemptAt: 1 })
geocodingJobSchema.index({ venueId: 1, status: 1 })

export const GeocodingJobModel =
  (mongoose.models.geocodingJob as mongoose.Model<IGeocodingJob>) ||
  mongoose.model<IGeocodingJob>('geocodingJob', geocodingJobSchema)
