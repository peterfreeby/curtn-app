import mongoose, { Schema, Types } from 'mongoose'

// Phase 4 — Proposal model. Staged edit waiting for a claimant's approval.
// One Proposal per atomic submission (whole form, not per-field). On approval
// the diff is applied to the target via writeAuditLog (Phase 3); on decline
// the row is terminal. Two flavors: single-approver (Venue/Company/Person/
// Show/Run/Stage) and joint stewardship (Performance — venue claimant ×
// run.productionCompany claimant; unanimous-with-14-day-timeout).

export type ProposalTargetKind =
  | 'Venue'
  | 'ProductionCompany'
  | 'Person'
  | 'Show'
  | 'Run'
  | 'Performance'
  | 'Stage'

export type ProposalProposerKind = 'User' | 'Scraper' | 'SyncFeed'

export type ProposalStatus =
  | 'pending'
  | 'approved'
  | 'declined'
  | 'auto-approved'
  | 'auto-declined-conflict'

export type ProposalApprovalRole = 'venue-claimant' | 'company-claimant'

// targetKindToRef maps the polymorphic kind back to the lowercase mongoose model
// name used by refPath. Keeps a single source of truth for the mapping.
export function targetKindToRef(kind: ProposalTargetKind): string {
  switch (kind) {
    case 'Venue': return 'venue'
    case 'ProductionCompany': return 'productionCompany'
    case 'Person': return 'person'
    case 'Show': return 'show'
    case 'Run': return 'run'
    case 'Performance': return 'performance'
    case 'Stage': return 'stage'
  }
}

export interface IProposalTarget {
  kind: ProposalTargetKind
  id: Types.ObjectId
}

export interface IProposalProposer {
  kind: ProposalProposerKind
  userId?: Types.ObjectId | null
  dataSourceId?: Types.ObjectId | null
  label?: string
}

export interface IProposalApproval {
  userId: Types.ObjectId
  role: ProposalApprovalRole
  approvedAt: Date
}

export interface IProposal {
  target: IProposalTarget
  proposer: IProposalProposer
  diff: Record<string, any>
  submissionVersion: Date
  status: ProposalStatus
  approvedBy?: Types.ObjectId | null
  approvedAt?: Date | null
  declinedBy?: Types.ObjectId | null
  declinedAt?: Date | null
  declineReason?: string | null
  isJointStewardship: boolean
  approvals: IProposalApproval[]
  firstApprovalAt?: Date | null
  conflictsWithProposalIds: Types.ObjectId[]
  // Set on Scraper proposals that wrap a PendingImport pending promotion.
  pendingImportId?: Types.ObjectId | null
  createdAt: Date
  updatedAt: Date
}

const proposalSchema = new Schema<IProposal>({
  target: {
    kind: {
      type: String,
      enum: ['Venue', 'ProductionCompany', 'Person', 'Show', 'Run', 'Performance', 'Stage'],
      required: true,
    },
    id: {
      type: Schema.Types.ObjectId,
      required: true,
      // We can't use refPath directly because target.kind is the GraphQL-style
      // PascalCase name; mongoose model names are lowercase. Keep id loose;
      // resolution happens in resolvers using targetKindToRef.
    },
  },
  proposer: {
    kind: {
      type: String,
      enum: ['User', 'Scraper', 'SyncFeed'],
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
  submissionVersion: { type: Date, required: true },
  status: {
    type: String,
    enum: ['pending', 'approved', 'declined', 'auto-approved', 'auto-declined-conflict'],
    default: 'pending',
    index: true,
  },
  approvedBy: { type: Schema.Types.ObjectId, ref: 'user', default: null },
  approvedAt: { type: Date, default: null },
  declinedBy: { type: Schema.Types.ObjectId, ref: 'user', default: null },
  declinedAt: { type: Date, default: null },
  declineReason: { type: String, default: null },
  isJointStewardship: { type: Boolean, default: false },
  approvals: [{
    userId: { type: Schema.Types.ObjectId, ref: 'user', required: true },
    role: { type: String, enum: ['venue-claimant', 'company-claimant'], required: true },
    approvedAt: { type: Date, required: true },
  }],
  firstApprovalAt: { type: Date, default: null },
  conflictsWithProposalIds: [{ type: Schema.Types.ObjectId, ref: 'proposal' }],
  pendingImportId: { type: Schema.Types.ObjectId, ref: 'pendingImport', default: null },
}, {
  timestamps: true,
})

// Per-target queue lookups
proposalSchema.index({ 'target.kind': 1, 'target.id': 1, status: 1 })
// Timeout cron scan
proposalSchema.index({ status: 1, firstApprovalAt: 1 })
// "My proposals as proposer" view
proposalSchema.index({ 'proposer.userId': 1, status: 1, createdAt: -1 })

export const ProposalModel = (mongoose.models.proposal as mongoose.Model<IProposal>) || mongoose.model<IProposal>('proposal', proposalSchema)
