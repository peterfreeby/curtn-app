import mongoose, { Schema, Types } from 'mongoose'

// Phase 7 — Block. Per-claimant, per-unit deny list. When an active row exists
// for (blockedUser, scopedTo), the blocked user's edits to that unit are
// silently rejected by canPerform. Block is per-unit (scopedTo); the blocker
// must be the unit's claimant or an admin.
//
// Append-mostly: `unblockUser` flips `revokedAt`. We never delete rows so the
// audit trail (Phase 3 AuditLog row per block creation) stays meaningful.

export type BlockScopedKind = 'Venue' | 'ProductionCompany' | 'Person'

export interface IBlockScopedTo {
  kind: BlockScopedKind
  id: Types.ObjectId
}

export interface IBlock {
  blocker: Types.ObjectId
  blockedUser: Types.ObjectId
  scopedTo: IBlockScopedTo
  reason: string
  createdAt: Date
  revokedAt: Date | null
  revokedBy: Types.ObjectId | null
  updatedAt: Date
}

const blockSchema = new Schema<IBlock>({
  blocker: {
    type: Schema.Types.ObjectId,
    ref: 'user',
    required: true,
  },
  blockedUser: {
    type: Schema.Types.ObjectId,
    ref: 'user',
    required: true,
  },
  scopedTo: {
    kind: {
      type: String,
      enum: ['Venue', 'ProductionCompany', 'Person'],
      required: true,
    },
    id: {
      type: Schema.Types.ObjectId,
      required: true,
    },
  },
  reason: {
    type: String,
    default: '',
  },
  revokedAt: {
    type: Date,
    default: null,
  },
  revokedBy: {
    type: Schema.Types.ObjectId,
    ref: 'user',
    default: null,
  },
}, {
  timestamps: true,
})

// Hot-path: "is this user blocked on this unit?" — checked from canPerform on
// every edit attempt against a claimed record.
blockSchema.index({ blockedUser: 1, 'scopedTo.id': 1, revokedAt: 1 })
// "Show me blocks I've created" — claimant dashboard.
blockSchema.index({ blocker: 1, createdAt: -1 })
// "Show me recent blocks across the platform" — admin block-activity page.
blockSchema.index({ createdAt: -1 })

export const BlockModel = (mongoose.models.block as mongoose.Model<IBlock>)
  || mongoose.model<IBlock>('block', blockSchema)
