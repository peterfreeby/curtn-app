import mongoose, { Schema, Types } from 'mongoose'

export interface ICredit {
  person: Types.ObjectId
  run: Types.ObjectId
  creditType: 'cast' | 'crew'
  role: string
  order: number
  createdAt: Date
  updatedAt: Date
  submittedBy: Types.ObjectId
}

const creditSchema = new Schema<ICredit>({
  person: {
    type: Schema.Types.ObjectId,
    ref: 'person',
    required: true
  },
  run: {
    type: Schema.Types.ObjectId,
    ref: 'run',
    required: true
  },
  creditType: {
    type: String,
    enum: ['cast', 'crew'],
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

creditSchema.index({ person: 1, run: 1, role: 1 }, { unique: true })
creditSchema.index({ run: 1, creditType: 1, order: 1 })
creditSchema.index({ person: 1, creditType: 1 })

export const CreditModel = (mongoose.models.credit as mongoose.Model<ICredit>) || mongoose.model<ICredit>('credit', creditSchema)
