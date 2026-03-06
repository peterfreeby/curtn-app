import mongoose, { Schema, Types } from 'mongoose'

export interface IStage {
  name: string
  slug: string
  venue: Types.ObjectId
  isDefault: boolean
  capacity?: number
  description?: string
  submittedBy: Types.ObjectId
  createdAt: Date
  updatedAt: Date
}

const stageSchema = new Schema<IStage>({
  name: {
    type: String,
    required: true,
    trim: true
  },
  slug: {
    type: String,
    required: true,
    lowercase: true,
    trim: true
  },
  venue: {
    type: Schema.Types.ObjectId,
    ref: 'venue',
    required: true
  },
  isDefault: {
    type: Boolean,
    default: false
  },
  capacity: {
    type: Number,
    min: 1
  },
  description: {
    type: String,
    trim: true
  },
  submittedBy: {
    type: Schema.Types.ObjectId,
    ref: 'user',
    required: true
  }
}, {
  timestamps: true
})

stageSchema.index({ venue: 1 })
stageSchema.index({ venue: 1, isDefault: 1 })
stageSchema.index({ slug: 1, venue: 1 }, { unique: true })

// Generate slug from name
stageSchema.pre('save', function(next) {
  if (this.isModified('name') && !this.slug) {
    this.slug = this.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
  }
  next()
})

export const StageModel = (mongoose.models.stage as mongoose.Model<IStage>) || mongoose.model<IStage>('stage', stageSchema)
