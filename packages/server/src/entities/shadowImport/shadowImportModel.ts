import mongoose, { Schema, Types } from 'mongoose'

// Phase 6 — ShadowImport.
// While a claimable unit is `claimed-synced healthy`, the scraper keeps
// running but writes its parsed events here instead of PendingImport. Shadow
// rows accumulate as a passive audit trail of "what the public web is saying
// about this venue" while the claimant's feed is authoritative. If the feed
// goes stale and the unit reverts to `claimed-passive` (per processSyncHealth
// 6-week rule), new scrapes resume writing to PendingImport.
//
// Schema mirrors PendingImport so the same downstream promotion logic could
// (optionally, later) consume it. The `purpose` discriminator is locked to
// 'shadow' so callers can never confuse the two collections.

export interface IShadowImport {
  dataSource: Types.ObjectId
  purpose: 'shadow'

  // Parsed event data (same shape as PendingImport)
  title: string
  runTitle?: string
  showDescription?: string
  runDescription?: string
  performanceDescription?: string
  performanceTypes?: string[]
  duration?: number
  date?: Date
  time?: string
  venueName?: string
  stageName?: string
  companyName?: string
  ticketUrl?: string
  imageUrl?: string
  startDate?: Date
  endDate?: Date
  cast?: { name: string; role?: string; headshotUrl?: string }[]
  crew?: { name: string; role?: string; headshotUrl?: string }[]
  rawData?: Record<string, any>

  importedAt: Date
  // Set when a claimant directly publishes a value contradicting what shadow
  // shows for the same logical event — kept for diagnostic UI but does not
  // affect any auto-applied behavior.
  overriddenByClaimantEditAt: Date | null
  error?: string
  createdAt: Date
  updatedAt: Date
}

const shadowImportSchema = new Schema<IShadowImport>({
  dataSource: {
    type: Schema.Types.ObjectId,
    ref: 'dataSource',
    required: true
  },
  purpose: {
    type: String,
    enum: ['shadow'],
    default: 'shadow',
    required: true
  },
  title: {
    type: String,
    required: true,
    trim: true
  },
  runTitle: { type: String, trim: true },
  showDescription: { type: String, trim: true },
  runDescription: { type: String, trim: true },
  performanceDescription: { type: String, trim: true },
  performanceTypes: [{ type: String, trim: true }],
  duration: { type: Number, min: 0 },
  date: Date,
  time: { type: String, trim: true },
  venueName: { type: String, trim: true },
  stageName: { type: String, trim: true },
  companyName: { type: String, trim: true },
  ticketUrl: { type: String, trim: true },
  imageUrl: { type: String, trim: true },
  startDate: Date,
  endDate: Date,
  cast: [{
    name: { type: String, trim: true },
    role: { type: String, trim: true },
    headshotUrl: { type: String, trim: true }
  }],
  crew: [{
    name: { type: String, trim: true },
    role: { type: String, trim: true },
    headshotUrl: { type: String, trim: true }
  }],
  rawData: Schema.Types.Mixed,
  importedAt: {
    type: Date,
    default: Date.now
  },
  overriddenByClaimantEditAt: {
    type: Date,
    default: null
  },
  error: String
}, {
  timestamps: true
})

shadowImportSchema.index({ dataSource: 1, importedAt: -1 })
shadowImportSchema.index({ purpose: 1, importedAt: -1 })

export const ShadowImportModel = (mongoose.models.shadowImport as mongoose.Model<IShadowImport>) || mongoose.model<IShadowImport>('shadowImport', shadowImportSchema)
