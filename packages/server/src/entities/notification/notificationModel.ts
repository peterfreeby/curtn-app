import mongoose, { Schema, Types } from 'mongoose'

// In-app Notification. Each row is a single event surfaced to one recipient.
// No external delivery (email/SMS deferred). UI consumes this via the
// `myNotifications` query and merges into the existing /feed page.
//
// See Projects/Claim & Edit Authority Model — Phase 2 — Scoping.

export type NotificationKind =
  | 'claim_approved'
  | 'claim_declined'
  | 'transfer_received'
  | 'transfer_accepted'
  | 'transfer_declined'
  | 'pre_expire_warning'
  | 'claim_expired'
  | 'proposal_received'
  | 'proposal_approved'
  | 'proposal_declined'
  | 'proposal_timeout_warning'
  | 'proposal_timeout_auto_approved'
  | 'trust_granted'
  | 'trust_revoked'
  | 'reciprocity_offered'
  | 'sync_connected'
  | 'sync_conflict_detected'
  | 'sync_stale_alert'
  | 'sync_recovered'
  | 'sync_reverted_to_passive'
  | 'sync_disconnected'

export interface INotification {
  recipient: Types.ObjectId
  kind: NotificationKind
  context: Record<string, any>
  readAt: Date | null
  createdAt: Date
  updatedAt: Date
}

const notificationSchema = new Schema<INotification>({
  recipient: {
    type: Schema.Types.ObjectId,
    ref: 'user',
    required: true
  },
  kind: {
    type: String,
    required: true,
    enum: [
      'claim_approved',
      'claim_declined',
      'transfer_received',
      'transfer_accepted',
      'transfer_declined',
      'pre_expire_warning',
      'claim_expired',
      'proposal_received',
      'proposal_approved',
      'proposal_declined',
      'proposal_timeout_warning',
      'proposal_timeout_auto_approved',
      'trust_granted',
      'trust_revoked',
      'reciprocity_offered',
      'sync_connected',
      'sync_conflict_detected',
      'sync_stale_alert',
      'sync_recovered',
      'sync_reverted_to_passive',
      'sync_disconnected',
    ]
  },
  context: {
    type: Schema.Types.Mixed,
    default: {}
  },
  readAt: {
    type: Date,
    default: null
  }
}, {
  timestamps: true
})

// Indexes
// "My unread, newest first" is the hot path.
notificationSchema.index({ recipient: 1, readAt: 1, createdAt: -1 })
notificationSchema.index({ recipient: 1, createdAt: -1 })

export const NotificationModel = (mongoose.models.notification as mongoose.Model<INotification>) || mongoose.model<INotification>('notification', notificationSchema)
