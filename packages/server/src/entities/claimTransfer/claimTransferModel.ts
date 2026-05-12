import mongoose, { Schema, Types } from 'mongoose'

// Phase 2 — self-service claim transfer.
// Current claimant initiates → recipient accepts or declines → transfer executes
// or rolls back. Stale transfers auto-expire via cron (Task 17).

export type ClaimTransferStatus = 'pending' | 'accepted' | 'declined' | 'expired'

export interface IClaimTransfer {
  fromUser: Types.ObjectId
  toUser: Types.ObjectId
  target: {
    kind: 'venue' | 'productionCompany' | 'person'
    id: Types.ObjectId
  }
  status: ClaimTransferStatus
  message?: string
  expiresAt: Date
  respondedAt?: Date
  createdAt: Date
  updatedAt: Date
}

const TRANSFER_EXPIRE_DAYS = 14

const claimTransferSchema = new Schema<IClaimTransfer>({
  fromUser: { type: Schema.Types.ObjectId, ref: 'user', required: true, index: true },
  toUser: { type: Schema.Types.ObjectId, ref: 'user', required: true, index: true },
  target: {
    kind: { type: String, enum: ['venue', 'productionCompany', 'person'], required: true },
    id: { type: Schema.Types.ObjectId, refPath: 'target.kind', required: true },
  },
  status: {
    type: String,
    enum: ['pending', 'accepted', 'declined', 'expired'],
    default: 'pending',
  },
  message: { type: String, trim: true },
  expiresAt: {
    type: Date,
    default: () => new Date(Date.now() + TRANSFER_EXPIRE_DAYS * 24 * 60 * 60 * 1000),
    index: true,
  },
  respondedAt: Date,
}, {
  timestamps: true,
})

// "My pending received transfers" — recipient dashboard
claimTransferSchema.index({ toUser: 1, status: 1, expiresAt: 1 })
// "My initiated transfers" — sender dashboard
claimTransferSchema.index({ fromUser: 1, status: 1, createdAt: -1 })

export const TRANSFER_EXPIRE_DAYS_CONST = TRANSFER_EXPIRE_DAYS

export const ClaimTransferModel = (mongoose.models.claimTransfer as mongoose.Model<IClaimTransfer>) || mongoose.model<IClaimTransfer>('claimTransfer', claimTransferSchema)
