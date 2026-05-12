import mongoose, { Schema, Types } from 'mongoose'

export interface IDataSource {
  name: string
  type: 'manual' | 'csv' | 'rss' | 'ical' | 'api' | 'web' | 'url' | 'scraper'
  // Phase 6 — 'scraper' = admin-managed, drives PendingImport / ShadowImport.
  // 'claimant-sync' = claimant-owned, drives runSync directly against the
  // claimed record and routes conflicts to the Phase 4 proposal queue.
  purpose: 'scraper' | 'claimant-sync'
  url?: string
  config: Record<string, any>
  associatedVenue?: Types.ObjectId
  associatedCompany?: Types.ObjectId
  associatedShow?: Types.ObjectId
  associatedRun?: Types.ObjectId
  fetchedUrls?: string[]
  lastPolledAt?: Date
  lastSuccessAt?: Date
  consecutiveFailures: number
  cooldownHours?: number
  disabledReason?: string
  // Rolling history of (filled fields / expected fields) per successful poll.
  // When the trailing average drops below 0.5 with enough samples, the source
  // is flagged needs-attention — usually a site redesign breaking selectors.
  fillRateSamples?: number[]
  healthStatus?: 'healthy' | 'needs-attention'
  healthReason?: string
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
  purpose: {
    type: String,
    enum: ['scraper', 'claimant-sync'],
    default: 'scraper',
    index: true,
    required: true
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
  lastSuccessAt: Date,
  consecutiveFailures: {
    type: Number,
    default: 0
  },
  cooldownHours: {
    type: Number
  },
  disabledReason: {
    type: String
  },
  fillRateSamples: {
    type: [Number],
    default: undefined
  },
  healthStatus: {
    type: String,
    enum: ['healthy', 'needs-attention']
  },
  healthReason: {
    type: String
  },
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
