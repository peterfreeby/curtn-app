import mongoose, { Schema, Types } from 'mongoose'

export interface IShowCompanyCredit {
  productionCompany: Types.ObjectId
  show: Types.ObjectId
  role: string
  order: number
  submittedBy: Types.ObjectId
  createdAt: Date
  updatedAt: Date
}

const showCompanyCreditSchema = new Schema<IShowCompanyCredit>({
  productionCompany: {
    type: Schema.Types.ObjectId,
    ref: 'productionCompany',
    required: true
  },
  show: {
    type: Schema.Types.ObjectId,
    ref: 'show',
    required: true
  },
  role: {
    type: String,
    required: true,
    trim: true
  },
  order: {
    type: Number,
    default: 0
  },
  submittedBy: {
    type: Schema.Types.ObjectId,
    ref: 'user',
    required: true
  }
}, {
  timestamps: true
})

showCompanyCreditSchema.index({ productionCompany: 1, show: 1, role: 1 }, { unique: true })
showCompanyCreditSchema.index({ show: 1, order: 1 })
showCompanyCreditSchema.index({ productionCompany: 1 })

export const ShowCompanyCreditModel = (mongoose.models.showCompanyCredit as mongoose.Model<IShowCompanyCredit>) || mongoose.model<IShowCompanyCredit>('showCompanyCredit', showCompanyCreditSchema)
