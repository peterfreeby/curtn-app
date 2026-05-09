import mongoose, { Schema, Types } from 'mongoose'

// Canonical performance type list. Keep in sync with the parseTypes
// normalizer in services/pendingImport/stage.ts. Values are lowercase by
// convention; the importer normalizes incoming "Dance" / "Theater" etc.
export const PERFORMANCE_TYPES = [
  'theater',
  'play',
  'musical',
  'music',
  'dance',
  'opera',
  'comedy',
  'improv',
  'spoken-word',
  'cabaret',
  'experimental',
  'immersive',
  'drag',
  'burlesque',
  'happening',
  'other'
] as const

export type PerformanceType = (typeof PERFORMANCE_TYPES)[number]

export interface IShow {
  title: string
  description: string
  performanceTypes: string[]
  duration: number
  languages: string[]
  url?: string
  imageUrl?: string
  posterUrl?: string
  wikidataId?: string
  source?: Types.ObjectId
  createdAt: Date
  updatedAt: Date
  verificationStatus: 'verified' | 'community'
  submittedBy: Types.ObjectId
}

const showSchema = new Schema<IShow>({
  title: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    default: ''
  },
  performanceTypes: [{
    type: String,
    enum: PERFORMANCE_TYPES
  }],
  duration: {
    type: Number,
    default: 0,
    min: 0
  },
  languages: [{
    type: String,
    default: ['English']
  }],
  url: {
    type: String,
    trim: true
  },
  imageUrl: String,
  posterUrl: String,
  wikidataId: String,
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

showSchema.index({ title: 'text', description: 'text' })
showSchema.index({ createdAt: -1, _id: -1 }) // cursor pagination
showSchema.index({ performanceTypes: 1 })

export const ShowModel = (mongoose.models.show as mongoose.Model<IShow>) || mongoose.model<IShow>('show', showSchema)
