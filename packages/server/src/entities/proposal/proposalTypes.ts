import {
  GraphQLBoolean,
  GraphQLList,
  GraphQLNonNull,
  GraphQLObjectType,
  GraphQLString,
} from 'graphql'
import { connectionDefinitions, globalIdField } from 'graphql-relay'
import { nodeInterface } from '../../graphql/nodeInterface'
import { entityRegister } from '../../graphql/entityHelpers'
import { ProposalModel, targetKindToRef } from './proposalModel'

// Phase 4 — GraphQL surface for Proposal. Diff and conflict info are exposed
// as JSON strings so the client renderer can branch by target.kind without
// pulling in a per-target type. Same shape pattern as AuditLogEntry.

const proposalTargetType = new GraphQLObjectType({
  name: 'ProposalTarget',
  fields: () => ({
    kind: { type: new GraphQLNonNull(GraphQLString), resolve: (t: any) => t.kind },
    targetId: { type: new GraphQLNonNull(GraphQLString), resolve: (t: any) => t.id?.toString() },
    name: {
      type: GraphQLString,
      resolve: async (t: any) => {
        const Model = getModelForKind(t.kind)
        if (!Model) return null
        const doc: any = await Model.findById(t.id).select('name title').lean()
        return doc?.name ?? doc?.title ?? null
      }
    },
    slug: {
      type: GraphQLString,
      resolve: async (t: any) => {
        const Model = getModelForKind(t.kind)
        if (!Model) return null
        const doc: any = await Model.findById(t.id).select('slug').lean()
        return doc?.slug ?? null
      }
    },
  })
})

const proposalProposerType = new GraphQLObjectType({
  name: 'ProposalProposer',
  fields: () => {
    const { userType } = require('../user/userTypes')
    return {
      kind: { type: new GraphQLNonNull(GraphQLString), resolve: (p: any) => p.kind },
      label: { type: GraphQLString, resolve: (p: any) => p.label ?? null },
      user: {
        type: userType,
        resolve: async (p: any) => {
          if (!p.userId) return null
          const { UserModel } = require('../user/userModel')
          return UserModel.findById(p.userId)
        }
      },
    }
  }
})

const proposalApprovalType = new GraphQLObjectType({
  name: 'ProposalApproval',
  fields: () => ({
    userId: { type: new GraphQLNonNull(GraphQLString), resolve: (a: any) => a.userId?.toString() },
    role: { type: new GraphQLNonNull(GraphQLString), resolve: (a: any) => a.role },
    approvedAt: { type: new GraphQLNonNull(GraphQLString), resolve: (a: any) => a.approvedAt?.toISOString() },
  })
})

export const proposalType: GraphQLObjectType = new GraphQLObjectType({
  name: 'Proposal',
  description: 'A staged edit waiting for claimant approval.',
  interfaces: () => [nodeInterface],
  fields: () => ({
    id: globalIdField('Proposal', p => p._id?.toString() ?? p.id),
    target: { type: new GraphQLNonNull(proposalTargetType), resolve: (p: any) => p.target },
    proposer: { type: new GraphQLNonNull(proposalProposerType), resolve: (p: any) => p.proposer },
    diffJson: {
      type: new GraphQLNonNull(GraphQLString),
      description: 'JSON-encoded diff: { fieldName: { old, new } }.',
      resolve: (p: any) => JSON.stringify(p.diff ?? {})
    },
    submissionVersion: { type: new GraphQLNonNull(GraphQLString), resolve: (p: any) => p.submissionVersion?.toISOString() },
    status: { type: new GraphQLNonNull(GraphQLString), resolve: (p: any) => p.status },
    isJointStewardship: { type: new GraphQLNonNull(GraphQLBoolean), resolve: (p: any) => !!p.isJointStewardship },
    isCommunityReview: { type: new GraphQLNonNull(GraphQLBoolean), resolve: (p: any) => !!p.isCommunityReview },
    approvals: { type: new GraphQLNonNull(new GraphQLList(proposalApprovalType)), resolve: (p: any) => p.approvals ?? [] },
    firstApprovalAt: { type: GraphQLString, resolve: (p: any) => p.firstApprovalAt?.toISOString() ?? null },
    declineReason: { type: GraphQLString, resolve: (p: any) => p.declineReason ?? null },
    conflictsWithProposalIds: {
      type: new GraphQLNonNull(new GraphQLList(GraphQLString)),
      resolve: (p: any) => (p.conflictsWithProposalIds ?? []).map((id: any) => id?.toString())
    },
    createdAt: { type: new GraphQLNonNull(GraphQLString), resolve: (p: any) => p.createdAt?.toISOString() },
    approvedAt: { type: GraphQLString, resolve: (p: any) => p.approvedAt?.toISOString() ?? null },
    declinedAt: { type: GraphQLString, resolve: (p: any) => p.declinedAt?.toISOString() ?? null },
  })
})

export const { connectionType: ProposalConnection } = connectionDefinitions({
  nodeType: proposalType
})

entityRegister({
  type: proposalType,
  nodeResolver: async (id) => await ProposalModel.findById(id)
})

function getModelForKind(kind: string): any {
  switch (kind) {
    case 'Venue': return require('../venue/venueModel').VenueModel
    case 'ProductionCompany': return require('../productionCompany/productionCompanyModel').ProductionCompanyModel
    case 'Person': return require('../person/personModel').PersonModel
    case 'Show': return require('../show/showModel').ShowModel
    case 'Run': return require('../run/runModel').RunModel
    case 'Performance': return require('../performance/performanceModel').PerformanceModel
    case 'Stage': return require('../stage/stageModel').StageModel
    default: return null
  }
}

// Exported for use in mutations needing to load the target.
export function modelForProposalKind(kind: string) {
  return getModelForKind(kind)
}

// Re-export targetKindToRef helper for consumers
export { targetKindToRef }
