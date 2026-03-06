import mongoose, { Schema, Types } from 'mongoose'

export interface IDataSource {
  name: string
  type: 'manual' | 'csv' | 'rss' | 'ical' | 'api'
  url?: string
  config: Record<string, any>
  associatedVenue?: Types.ObjectId
  associatedCompany?: Types.ObjectId
  lastPolledAt?: Date
  isActive: boolean
  createdBy: Types.ObjectId
  createdAt: Date
  updatedAt: Date
}

const dataSourceSchema = new Schema<IDataSource>({
  name: {
    type: String,
    required: true,
    trim: true
  },
  type: {
    type: String,
    required: true,
    enum: ['manual', 'csv', 'rss', 'ical', 'api']
  },
  url: {
    type: String,
    trim: true
  },
  config: {
    type: Schema.Types.Mixed,
    default: {}
  },
  associatedVenue: {
    type: Schema.Types.ObjectId,
    ref: 'venue'
  },
  associatedCompany: {
    type: Schema.Types.ObjectId,
    ref: 'productionCompany'
  },
  lastPolledAt: Date,
  isActive: {
    type: Boolean,
    default: true
  },
  createdBy: {
    type: Schema.Types.ObjectId,
    ref: 'user',
    required: true
  }
}, {
  timestamps: true
})

dataSourceSchema.index({ type: 1 })
dataSourceSchema.index({ isActive: 1 })

export const DataSourceModel = (mongoose.models.dataSource as mongoose.Model<IDataSource>) || mongoose.model<IDataSource>('dataSource', dataSourceSchema)
