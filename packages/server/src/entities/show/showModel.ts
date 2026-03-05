import mongoose, { Schema, Types } from 'mongoose'

export interface IShow {
  title: string
  description: string
  performanceTypes: string[]
  duration: number
  languages: string[]
  url?: string
  wikidataId?: string
  createdAt: Date
  updatedAt: Date
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
    enum: ['theater', 'musical', 'dance', 'comedy', 'improv', 'spoken-word', 'cabaret', 'experimental', 'immersive', 'drag', 'burlesque', 'happening', 'other']
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
  wikidataId: String,
  submittedBy: {
    type: Schema.Types.ObjectId,
    ref: 'user',
    required: true
  }
}, {
  timestamps: true
})

showSchema.index({ title: 'text', description: 'text' })
showSchema.index({ performanceTypes: 1 })

export const ShowModel = (mongoose.models.show as mongoose.Model<IShow>) || mongoose.model<IShow>('show', showSchema)
