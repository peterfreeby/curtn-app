import { Schema, Types } from 'mongoose'

// Shared schema fragment + types for any claimable unit (Venue, ProductionCompany, Person).
// See Projects/Claim & Edit Authority Model for the design.

export const CLAIM_STATES = [
  'unclaimed',
  'provisionally-claimed',
  'claimed-passive',
  'claimed-synced',
] as const

export type ClaimState = typeof CLAIM_STATES[number]

export const SYNC_HEALTHS = ['healthy', 'stale'] as const

export type SyncHealth = typeof SYNC_HEALTHS[number] | null

export interface IClaimableFields {
  claimState: ClaimState
  claimedBy: Types.ObjectId | null
  claimedAt: Date | null
  syncHealth: SyncHealth
  syncSourceConnectedAt: Date | null
  lastClaimantActivityAt: Date | null
}

export const claimableFieldsSchema = {
  claimState: {
    type: String,
    enum: [...CLAIM_STATES],
    default: 'unclaimed' as ClaimState,
    required: true,
    index: true,
  },
  claimedBy: {
    type: Schema.Types.ObjectId,
    ref: 'user',
    default: null,
    index: true,
  },
  claimedAt: {
    type: Date,
    default: null,
  },
  syncHealth: {
    type: String,
    enum: [...SYNC_HEALTHS, null],
    default: null,
  },
  syncSourceConnectedAt: {
    type: Date,
    default: null,
  },
  lastClaimantActivityAt: {
    type: Date,
    default: null,
    index: true,
  },
}
