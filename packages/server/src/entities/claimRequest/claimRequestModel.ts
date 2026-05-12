import mongoose, { Schema, Types } from 'mongoose'

export type ClaimTargetKind = 'venue' | 'productionCompany' | 'person'

export interface IClaimTarget {
  kind: ClaimTargetKind
  id: Types.ObjectId
}

// Phase 8 — verification signals sub-document. Each signal contributes points
// toward an auto-promotion score; threshold = 100 → auto-approve. Trust-graph
// endorsements are the load-bearing signal (grounded in Phase 5 design);
// webmaster verification + external profile linking are additive proposed
// signals (Bluesky / Wikidata patterns).

export type ExternalProfilePlatform =
  | 'imdb-pro'
  | 'wikidata'
  | 'spotify-artist'
  | 'wikipedia'
  | 'other'

export interface IExternalProfileLink {
  url: string
  platform: ExternalProfilePlatform
  verifiedAt?: Date
}

export interface ITrustGraphEndorsement {
  grantingUnit: {
    kind: string
    id: Types.ObjectId
  }
  grantedAt: Date
}

export interface IClaimSignals {
  webmasterVerified: boolean
  webmasterToken?: string
  webmasterTokenExpires?: Date
  externalProfileLinks: IExternalProfileLink[]
  trustGraphEndorsements: ITrustGraphEndorsement[]
  autoPromotionScore: number
  autoPromotedAt?: Date
}

export interface IClaimRequest {
  user: Types.ObjectId
  // Legacy field — pre-Phase-1 claims targeted Person only. New claims use `target`.
  // Backfill migration populates `target` from `person` and Phase 2 drops this field.
  person?: Types.ObjectId
  target?: IClaimTarget
  status: 'pending' | 'approved' | 'rejected'
  message?: string
  requestedAt: Date
  reviewedAt?: Date
  reviewedBy?: Types.ObjectId
  reviewerNotes?: string
  signals: IClaimSignals
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
    ref: 'person'
  },
  target: {
    kind: {
      type: String,
      enum: ['venue', 'productionCompany', 'person']
    },
    id: {
      type: Schema.Types.ObjectId,
      refPath: 'target.kind'
    }
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
  },
  reviewerNotes: {
    type: String,
    trim: true
  },
  signals: {
    webmasterVerified: { type: Boolean, default: false },
    webmasterToken: { type: String },
    webmasterTokenExpires: { type: Date },
    externalProfileLinks: {
      type: [{
        url: { type: String, required: true },
        platform: {
          type: String,
          enum: ['imdb-pro', 'wikidata', 'spotify-artist', 'wikipedia', 'other'],
          required: true,
        },
        verifiedAt: { type: Date },
      }],
      default: [],
    },
    trustGraphEndorsements: {
      type: [{
        grantingUnit: {
          kind: { type: String },
          id: { type: Schema.Types.ObjectId },
        },
        grantedAt: { type: Date },
      }],
      default: [],
    },
    autoPromotionScore: { type: Number, default: 0 },
    autoPromotedAt: { type: Date },
  },
}, {
  timestamps: true
})

claimRequestSchema.index({ status: 1, requestedAt: -1 })
// Legacy unique index — partial so only legacy rows (with person set) are constrained.
claimRequestSchema.index(
  { user: 1, person: 1 },
  {
    unique: true,
    partialFilterExpression: { person: { $type: 'objectId' } }
  }
)
// New unique index on the polymorphic target. Partial so legacy rows without target don't collide.
claimRequestSchema.index(
  { user: 1, 'target.kind': 1, 'target.id': 1 },
  {
    unique: true,
    partialFilterExpression: { 'target.kind': { $type: 'string' } }
  }
)

export const ClaimRequestModel = (mongoose.models.claimRequest as mongoose.Model<IClaimRequest>) || mongoose.model<IClaimRequest>('claimRequest', claimRequestSchema)
