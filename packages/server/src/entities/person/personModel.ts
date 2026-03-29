import mongoose, { Schema, Types } from 'mongoose'

export interface IPerson {
  name: string
  slug: string
  bio?: string
  headshotUrl?: string
  wikidataId?: string
  userId?: Types.ObjectId
  createdAt: Date
  updatedAt: Date
  submittedBy: Types.ObjectId
}

const personSchema = new Schema<IPerson>({
  name: {
    type: String,
    required: true,
    trim: true
  },
  slug: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  bio: {
    type: String,
    trim: true
  },
  headshotUrl: String,
  wikidataId: String,
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'user',
    default: null
  },
  submittedBy: {
    type: Schema.Types.ObjectId,
    ref: 'user',
    required: true
  }
}, {
  timestamps: true
})

personSchema.index({ name: 'text', bio: 'text' })
personSchema.index({ slug: 1 }, { unique: true })
personSchema.index({ name: 1 })
personSchema.index({ userId: 1 }, { unique: true, sparse: true })

personSchema.pre('save', function(next) {
  if (this.isModified('name') && !this.slug) {
    this.slug = this.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
  }
  next()
})

export const PersonModel = (mongoose.models.person as mongoose.Model<IPerson>) || mongoose.model<IPerson>('person', personSchema)
