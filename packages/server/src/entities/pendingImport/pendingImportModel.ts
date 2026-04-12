import mongoose, { Schema, Types } from 'mongoose'

export interface IPendingImport {
  dataSource: Types.ObjectId
  status: 'pending' | 'approved' | 'rejected'

  // Parsed event data (flat, ready to promote into Show/Run/Performance)
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
  credits?: { name: string; role?: string; headshotUrl?: string }[]

  // Raw source data for debugging
  rawData?: Record<string, any>

  // Tracking
  importedAt: Date
  reviewedAt?: Date
  reviewedBy?: Types.ObjectId
  error?: string
  createdAt: Date
  updatedAt: Date
}

const pendingImportSchema = new Schema<IPendingImport>({
  dataSource: {
    type: Schema.Types.ObjectId,
    ref: 'dataSource',
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending'
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
  credits: [{
    name: { type: String, trim: true },
    role: { type: String, trim: true },
    headshotUrl: { type: String, trim: true }
  }],
  rawData: Schema.Types.Mixed,
  importedAt: {
    type: Date,
    default: Date.now
  },
  reviewedAt: Date,
  reviewedBy: {
    type: Schema.Types.ObjectId,
    ref: 'user'
  },
  error: String
}, {
  timestamps: true
})

pendingImportSchema.index({ status: 1, importedAt: -1 })
pendingImportSchema.index({ dataSource: 1, status: 1 })
pendingImportSchema.index({ importedAt: 1 }) // for auto-validate query

export const PendingImportModel = (mongoose.models.pendingImport as mongoose.Model<IPendingImport>) || mongoose.model<IPendingImport>('pendingImport', pendingImportSchema)
