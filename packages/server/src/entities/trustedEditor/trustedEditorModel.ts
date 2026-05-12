import mongoose, { Schema, Types } from 'mongoose'

// Phase 5 — TrustedEditor. Directional, non-transitive grant from a claimed
// unit (Venue / ProductionCompany / Person) to a recipient (User or unit).
// `canPerform` consults active rows to short-circuit the queue and auto-publish
// within the granted scope. Cascade is 1-hop: a grant whose recipient is a unit
// extends to that unit's claimant and to Manager-scope editors of that unit.
//
// Append-mostly: revocation flips `revokedAt`/`revokedBy` rather than deleting.
// See Projects/Claim & Edit Authority Model — Phase 5 — Scoping.

export type GrantedOnKind = 'Venue' | 'ProductionCompany' | 'Person'
export type RecipientKind = 'User' | 'Venue' | 'ProductionCompany' | 'Person'
export type TrustedEditorRoleTemplate = 'Manager' | 'Booker' | 'Publicist' | 'Personal' | 'Custom'

export interface ITrustedEditorTarget {
  kind: GrantedOnKind
  id: Types.ObjectId
}

export interface ITrustedEditorRecipient {
  kind: RecipientKind
  id: Types.ObjectId
}

export interface ITrustedEditor {
  grantedOn: ITrustedEditorTarget
  recipient: ITrustedEditorRecipient
  scope: string[]
  roleTemplate: TrustedEditorRoleTemplate
  grantedBy: Types.ObjectId
  grantedAt: Date
  revokedAt: Date | null
  revokedBy: Types.ObjectId | null
  createdAt: Date
  updatedAt: Date
}

const trustedEditorSchema = new Schema<ITrustedEditor>({
  grantedOn: {
    kind: {
      type: String,
      enum: ['Venue', 'ProductionCompany', 'Person'],
      required: true,
      index: true,
    },
    id: {
      type: Schema.Types.ObjectId,
      required: true,
      index: true,
    },
  },
  recipient: {
    kind: {
      type: String,
      enum: ['User', 'Venue', 'ProductionCompany', 'Person'],
      required: true,
      index: true,
    },
    id: {
      type: Schema.Types.ObjectId,
      required: true,
      index: true,
    },
  },
  scope: {
    type: [String],
    required: true,
    default: [],
  },
  roleTemplate: {
    type: String,
    enum: ['Manager', 'Booker', 'Publicist', 'Personal', 'Custom'],
    required: true,
  },
  grantedBy: {
    type: Schema.Types.ObjectId,
    ref: 'user',
    required: true,
  },
  grantedAt: {
    type: Date,
    default: Date.now,
  },
  revokedAt: {
    type: Date,
    default: null,
    index: true,
  },
  revokedBy: {
    type: Schema.Types.ObjectId,
    ref: 'user',
    default: null,
  },
}, {
  timestamps: true,
})

// Hot-path lookups: "what active grants exist on this unit"
trustedEditorSchema.index({ 'grantedOn.kind': 1, 'grantedOn.id': 1, revokedAt: 1 })
// "what active grants does this recipient have"
trustedEditorSchema.index({ 'recipient.kind': 1, 'recipient.id': 1, revokedAt: 1 })

export const TrustedEditorModel = (mongoose.models.trustedEditor as mongoose.Model<ITrustedEditor>)
  || mongoose.model<ITrustedEditor>('trustedEditor', trustedEditorSchema)
