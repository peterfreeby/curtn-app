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
    ref: 'user'
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
personSchema.index({ name: 1, _id: 1 }) // cursor pagination
// partialFilterExpression is more robust than `sparse` here: sparse skips docs
// where the field doesn't exist, but if any code ever sets userId: null
// explicitly, sparse still indexes it and we collide. Filtering on $exists +
// $type catches both null and missing.
personSchema.index(
  { userId: 1 },
  {
    unique: true,
    partialFilterExpression: { userId: { $type: 'objectId' } }
  }
)

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
