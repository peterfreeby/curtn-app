import mongoose, { Schema, Types } from 'mongoose'

export interface IRun {
  show: Types.ObjectId
  title?: string
  productionCompany?: Types.ObjectId
  venues: Types.ObjectId[]
  stage?: Types.ObjectId
  intermissions: number
  startDate?: Date
  endDate?: Date
  description?: string
  imageUrl?: string
  posterUrl?: string
  wikidataId?: string
  eventbriteId?: string
  source?: Types.ObjectId
  createdAt: Date
  updatedAt: Date
  verificationStatus: 'verified' | 'community'
  submittedBy: Types.ObjectId
}

const runSchema = new Schema<IRun>({
  show: {
    type: Schema.Types.ObjectId,
    ref: 'show',
    required: true
  },
  productionCompany: {
    type: Schema.Types.ObjectId,
    ref: 'productionCompany'
  },
  venues: [{
    type: Schema.Types.ObjectId,
    ref: 'venue'
  }],
  title: {
    type: String,
    trim: true
  },
  stage: {
    type: Schema.Types.ObjectId,
    ref: 'stage'
  },
  intermissions: {
    type: Number,
    default: 0,
    min: 0
  },
  startDate: Date,
  endDate: Date,
  description: {
    type: String,
    trim: true
  },
  imageUrl: String,
  posterUrl: String,
  wikidataId: String,
  eventbriteId: String,
  source: {
    type: Schema.Types.ObjectId,
    ref: 'dataSource'
  },
  verificationStatus: {
    type: String,
    enum: ['verified', 'community'],
    default: 'verified'
  },
  submittedBy: {
    type: Schema.Types.ObjectId,
    ref: 'user',
    required: true
  }
}, {
  timestamps: true
})

runSchema.index({ show: 1 })
runSchema.index({ productionCompany: 1 })
runSchema.index({ venues: 1 })
runSchema.index({ show: 1, productionCompany: 1, venues: 1 })

export const RunModel = (mongoose.models.run as mongoose.Model<IRun>) || mongoose.model<IRun>('run', runSchema)
