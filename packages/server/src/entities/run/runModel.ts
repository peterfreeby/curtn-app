import mongoose, { Schema, Types } from 'mongoose'

export interface IRun {
  show: Types.ObjectId
  productionCompany?: Types.ObjectId
  venues: Types.ObjectId[]
  intermissions: number
  startDate?: Date
  endDate?: Date
  description?: string
  wikidataId?: string
  eventbriteId?: string
  createdAt: Date
  updatedAt: Date
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
  wikidataId: String,
  eventbriteId: String,
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
