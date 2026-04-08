import mongoose, { Schema, Types } from 'mongoose'

export interface IPerformance {
  run: Types.ObjectId
  date: Date
  time: string
  venueId: Types.ObjectId
  ticketUrl?: string
  eventbriteId?: string
  soldOut: boolean
  stageOverride?: Types.ObjectId
  metadataOverrides?: {
    description?: string
    imageUrl?: string
  }
  creditOverrides?: {
    added: Types.ObjectId[]
    removed: Types.ObjectId[]
  }
  source?: Types.ObjectId
  createdAt: Date
  updatedAt: Date
  submittedBy: Types.ObjectId
}

const performanceSchema = new Schema<IPerformance>({
  run: {
    type: Schema.Types.ObjectId,
    ref: 'run',
    required: true
  },
  date: {
    type: Date,
    required: true
  },
  time: {
    type: String,
    required: true,
    trim: true
  },
  venueId: {
    type: Schema.Types.ObjectId,
    ref: 'venue',
    required: true
  },
  ticketUrl: String,
  eventbriteId: String,
  soldOut: {
    type: Boolean,
    default: false
  },
  stageOverride: {
    type: Schema.Types.ObjectId,
    ref: 'stage'
  },
  metadataOverrides: {
    description: String,
    imageUrl: String
  },
  creditOverrides: {
    added: [{
      type: Schema.Types.ObjectId,
      ref: 'credit'
    }],
    removed: [{
      type: Schema.Types.ObjectId,
      ref: 'credit'
    }]
  },
  source: {
    type: Schema.Types.ObjectId,
    ref: 'dataSource'
  },
  submittedBy: {
    type: Schema.Types.ObjectId,
    ref: 'user',
    required: true
  }
}, {
  timestamps: true
})

performanceSchema.index({ run: 1, date: -1 })
performanceSchema.index({ venueId: 1, date: -1 })
performanceSchema.index({ date: 1 })
performanceSchema.index({ date: -1, _id: -1 }) // cursor pagination descending
performanceSchema.index({ date: 1, _id: 1 }) // cursor pagination ascending

export const PerformanceModel = (mongoose.models.performance as mongoose.Model<IPerformance>) || mongoose.model<IPerformance>('performance', performanceSchema)
