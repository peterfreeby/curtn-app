import mongoose, { Schema, Types } from 'mongoose'

export interface IClaimRequest {
  user: Types.ObjectId
  person: Types.ObjectId
  status: 'pending' | 'approved' | 'rejected'
  message?: string
  requestedAt: Date
  reviewedAt?: Date
  reviewedBy?: Types.ObjectId
  createdAt: Date
  updatedAt: Date
}

const claimRequestSchema = new Schema<IClaimRequest>({
  user: {
    type: Schema.Types.ObjectId,
    ref: 'user',
    required: true
  },
  person: {
    type: Schema.Types.ObjectId,
    ref: 'person',
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending'
  },
  message: {
    type: String,
    trim: true
  },
  requestedAt: {
    type: Date,
    default: Date.now
  },
  reviewedAt: Date,
  reviewedBy: {
    type: Schema.Types.ObjectId,
    ref: 'user'
  }
}, {
  timestamps: true
})

claimRequestSchema.index({ status: 1, requestedAt: -1 })
claimRequestSchema.index({ user: 1, person: 1 }, { unique: true })

export const ClaimRequestModel = (mongoose.models.claimRequest as mongoose.Model<IClaimRequest>) || mongoose.model<IClaimRequest>('claimRequest', claimRequestSchema)
