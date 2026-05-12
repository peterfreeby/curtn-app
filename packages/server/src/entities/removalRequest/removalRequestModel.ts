import mongoose, { Schema, Types } from 'mongoose'

// User-facing request to hide an AuditLog row. Admin reviews from a queue;
// approval flips the targeted AuditLog's hidden* fields. The record itself
// stays in the collection so the admin trail is preserved.

export type RemovalRequestCategory = 'deadname' | 'harassment' | 'copyright' | 'privacy' | 'other'
export type RemovalRequestStatus = 'pending' | 'approved' | 'declined'

export interface IRemovalRequest {
  requester: Types.ObjectId
  targetAuditLog: Types.ObjectId
  reason: string
  category: RemovalRequestCategory
  status: RemovalRequestStatus
  reviewedAt?: Date | null
  reviewedBy?: Types.ObjectId | null
  reviewerNotes?: string | null
  createdAt: Date
  updatedAt: Date
}

const removalRequestSchema = new Schema<IRemovalRequest>({
  requester: { type: Schema.Types.ObjectId, ref: 'user', required: true },
  targetAuditLog: { type: Schema.Types.ObjectId, ref: 'auditLog', required: true },
  reason: { type: String, required: true },
  category: {
    type: String,
    enum: ['deadname', 'harassment', 'copyright', 'privacy', 'other'],
    required: true,
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'declined'],
    default: 'pending',
  },
  reviewedAt: { type: Date, default: null },
  reviewedBy: { type: Schema.Types.ObjectId, ref: 'user', default: null },
  reviewerNotes: { type: String, default: null },
}, {
  timestamps: true,
})

removalRequestSchema.index({ status: 1, createdAt: -1 })
removalRequestSchema.index({ requester: 1, createdAt: -1 })

export const RemovalRequestModel =
  (mongoose.models.removalRequest as mongoose.Model<IRemovalRequest>) ||
  mongoose.model<IRemovalRequest>('removalRequest', removalRequestSchema)
