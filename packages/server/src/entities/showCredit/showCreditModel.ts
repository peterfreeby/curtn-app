import mongoose, { Schema, Types } from 'mongoose'

export interface IShowCredit {
  person: Types.ObjectId
  show: Types.ObjectId
  role: string
  order: number
  submittedBy: Types.ObjectId
  createdAt: Date
  updatedAt: Date
}

const showCreditSchema = new Schema<IShowCredit>({
  person: {
    type: Schema.Types.ObjectId,
    ref: 'person',
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

showCreditSchema.index({ person: 1, show: 1, role: 1 }, { unique: true })
showCreditSchema.index({ show: 1, order: 1 })
showCreditSchema.index({ person: 1 })

export const ShowCreditModel = (mongoose.models.showCredit as mongoose.Model<IShowCredit>) || mongoose.model<IShowCredit>('showCredit', showCreditSchema)
