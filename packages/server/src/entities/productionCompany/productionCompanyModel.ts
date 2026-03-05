import mongoose, { Schema, Types } from 'mongoose'

export interface IProductionCompany {
  name: string
  slug: string
  description?: string
  logoUrl?: string
  wikidataId?: string
  createdAt: Date
  updatedAt: Date
  submittedBy: Types.ObjectId
}

const productionCompanySchema = new Schema<IProductionCompany>({
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
  description: {
    type: String,
    trim: true
  },
  logoUrl: String,
  wikidataId: String,
  submittedBy: {
    type: Schema.Types.ObjectId,
    ref: 'user',
    required: true
  }
}, {
  timestamps: true
})

productionCompanySchema.index({ name: 'text', description: 'text' })
productionCompanySchema.index({ slug: 1 }, { unique: true })
productionCompanySchema.index({ name: 1 })

productionCompanySchema.pre('save', function(next) {
  if (this.isModified('name') && !this.slug) {
    this.slug = this.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
  }
  next()
})

export const ProductionCompanyModel = (mongoose.models.productionCompany as mongoose.Model<IProductionCompany>) || mongoose.model<IProductionCompany>('productionCompany', productionCompanySchema)
