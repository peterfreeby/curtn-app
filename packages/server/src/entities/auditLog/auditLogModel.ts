import mongoose, { Schema, Types } from 'mongoose'

// Phase 3 — Edit history. One row per submission with multi-field JSON diff.
//
// Append-only by design — no UPDATE or DELETE through normal flows.
// "Revert" appends a new corrective entry rather than mutating an old one.
// Admin-only `revision deletion` flips `hiddenAt` to suppress from public view
// while preserving the row for the admin audit trail.

export type AuditTargetKind = 'Venue' | 'ProductionCompany' | 'Person' | 'Show' | 'Run' | 'Performance' | 'Stage'
export type AuditAuthorKind = 'User' | 'Scraper' | 'SyncFeed' | 'System'
export type ApprovalSource =
  | 'direct-publish'
  | 'claimant-approved'
  | 'timeout-approved'
  | 'trusted-editor'
  | 'admin-override'
  | 'community-approved'

export interface IAuditLogTarget {
  kind: AuditTargetKind
  id: Types.ObjectId
}

export interface IAuditLogAuthor {
  kind: AuditAuthorKind
  userId?: Types.ObjectId | null
  dataSourceId?: Types.ObjectId | null
  label?: string
}

export interface IAuditLog {
  target: IAuditLogTarget
  author: IAuditLogAuthor
  diff: Record<string, any>
  approvalSource: ApprovalSource
  approvalContext: Record<string, any>
  isRevert: boolean
  revertOf?: Types.ObjectId | null
  hiddenAt?: Date | null
  hiddenBy?: Types.ObjectId | null
  hiddenReason?: string | null
  createdAt: Date
  updatedAt: Date
}

const auditLogSchema = new Schema<IAuditLog>({
  target: {
    kind: {
      type: String,
      enum: ['Venue', 'ProductionCompany', 'Person', 'Show', 'Run', 'Performance', 'Stage'],
      required: true,
    },
    id: {
      type: Schema.Types.ObjectId,
      refPath: 'target.kind',
      required: true,
    }
  },
  author: {
    kind: {
      type: String,
      enum: ['User', 'Scraper', 'SyncFeed', 'System'],
      required: true,
    },
    userId: { type: Schema.Types.ObjectId, ref: 'user', default: null },
    dataSourceId: { type: Schema.Types.ObjectId, ref: 'dataSource', default: null },
    label: { type: String },
  },
  diff: {
    type: Schema.Types.Mixed,
    required: true,
  },
  approvalSource: {
    type: String,
    enum: ['direct-publish', 'claimant-approved', 'timeout-approved', 'trusted-editor', 'admin-override', 'community-approved'],
    required: true,
  },
  approvalContext: {
    type: Schema.Types.Mixed,
    default: {},
  },
  isRevert: {
    type: Boolean,
    default: false,
  },
  revertOf: {
    type: Schema.Types.ObjectId,
    ref: 'auditLog',
    default: null,
  },
  hiddenAt: { type: Date, default: null },
  hiddenBy: { type: Schema.Types.ObjectId, ref: 'user', default: null },
  hiddenReason: { type: String, default: null },
}, {
  timestamps: true,
})

// Per-record history (the hot path for the EditHistory UI)
auditLogSchema.index({ 'target.kind': 1, 'target.id': 1, createdAt: -1 })
// Admin queries by author
auditLogSchema.index({ 'author.userId': 1, createdAt: -1 })
// Find hidden rows (admin only)
auditLogSchema.index({ hiddenAt: 1 })

export const AuditLogModel = (mongoose.models.auditLog as mongoose.Model<IAuditLog>) || mongoose.model<IAuditLog>('auditLog', auditLogSchema)
