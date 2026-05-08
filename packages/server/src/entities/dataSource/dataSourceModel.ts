import mongoose, { Schema, Types } from 'mongoose'

export interface IDataSource {
  name: string
  type: 'manual' | 'csv' | 'rss' | 'ical' | 'api' | 'web' | 'url' | 'scraper'
  url?: string
  config: Record<string, any>
  associatedVenue?: Types.ObjectId
  associatedCompany?: Types.ObjectId
  associatedShow?: Types.ObjectId
  associatedRun?: Types.ObjectId
  fetchedUrls?: string[]
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
    enum: ['manual', 'csv', 'rss', 'ical', 'api', 'web', 'url', 'scraper']
  },
  url: {
    type: String,
    trim: true
  },
  config: {
    type: Schema.Types.Mixed,
    default: {}
  },
  fetchedUrls: [{ type: String }],
  associatedVenue: {
    type: Schema.Types.ObjectId,
    ref: 'venue'
  },
  associatedCompany: {
    type: Schema.Types.ObjectId,
    ref: 'productionCompany'
  },
  associatedShow: {
    type: Schema.Types.ObjectId,
    ref: 'show'
  },
  associatedRun: {
    type: Schema.Types.ObjectId,
    ref: 'run'
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
dataSourceSchema.index({ associatedVenue: 1 })
dataSourceSchema.index({ associatedCompany: 1 })
dataSourceSchema.index({ associatedShow: 1 })
dataSourceSchema.index({ associatedRun: 1 })

export const DataSourceModel = (mongoose.models.dataSource as mongoose.Model<IDataSource>) || mongoose.model<IDataSource>('dataSource', dataSourceSchema)
