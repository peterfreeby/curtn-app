import { GraphQLInt, GraphQLList, GraphQLNonNull, GraphQLString } from 'graphql'
import { Types } from 'mongoose'
import { ProposalModel } from '../proposalModel'
import { proposalType } from '../proposalTypes'
import { VenueModel } from '../../venue/venueModel'
import { ProductionCompanyModel } from '../../productionCompany/productionCompanyModel'
import { PersonModel } from '../../person/personModel'
import { PerformanceModel } from '../../performance/performanceModel'
import { RunModel } from '../../run/runModel'
import { UserModel } from '../../user/userModel'

// Phase 4 — queue queries.
//
//   myPendingProposals: pending proposals on units the current user steward.
//     Filters: authorType ('User' | 'Scraper' | null), targetKind, recency.
//     Sorted: conflict-grouped at top, then newest-first.
//   pendingProposalsForTarget: pending proposals on a specific entity, for
//     the in-context "pending edits" strip on detail pages.

async function targetIdsClaimedBy(userId: string): Promise<{
  venueIds: Types.ObjectId[]
  companyIds: Types.ObjectId[]
  personIds: Types.ObjectId[]
  performanceIds: Types.ObjectId[]
}> {
  const [venues, companies, persons] = await Promise.all([
    VenueModel.find({ claimedBy: userId }).select('_id').lean(),
    ProductionCompanyModel.find({ claimedBy: userId }).select('_id').lean(),
    PersonModel.find({ claimedBy: userId }).select('_id').lean(),
  ])

  const venueIds = venues.map(v => v._id)
  const companyIds = companies.map(c => c._id)
  const personIds = persons.map(p => p._id)

  // Performances steward = performances whose venue is claimed by user OR
  // whose run.productionCompany is claimed by user.
  const runs = await RunModel.find({ productionCompany: { $in: companyIds } }).select('_id').lean()
  const runIds = runs.map(r => r._id)

  const performances = await PerformanceModel.find({
    $or: [
      { venueId: { $in: venueIds } },
      { run: { $in: runIds } },
    ],
  }).select('_id').lean()
  const performanceIds = performances.map(p => p._id)

  return { venueIds, companyIds, personIds, performanceIds }
}

export const proposalQueries = {
  myPendingProposals: {
    type: new GraphQLList(proposalType),
    description: 'Pending proposals on units the authenticated user steward. Sorted newest first.',
    args: {
      authorType: { type: GraphQLString, description: 'Optional filter: "User" or "Scraper".' },
      targetKind: { type: GraphQLString, description: 'Optional filter: Venue / ProductionCompany / Person / Performance / etc.' },
      sinceDays: { type: GraphQLInt, description: 'Optional recency filter (proposals created in the last N days).' },
    },
    resolve: async (_: any, args: any, ctx: any) => {
      if (!ctx.user) return []

      const adminUser = await UserModel.findById(ctx.user.id).select('isAdmin').lean()
      const isAdmin = !!adminUser?.isAdmin

      const claimed = await targetIdsClaimedBy(ctx.user.id)

      const targetClauses: any[] = []
      if (!isAdmin) {
        if (claimed.venueIds.length) targetClauses.push({ 'target.kind': 'Venue', 'target.id': { $in: claimed.venueIds } })
        if (claimed.companyIds.length) targetClauses.push({ 'target.kind': 'ProductionCompany', 'target.id': { $in: claimed.companyIds } })
        if (claimed.personIds.length) targetClauses.push({ 'target.kind': 'Person', 'target.id': { $in: claimed.personIds } })
        if (claimed.performanceIds.length) targetClauses.push({ 'target.kind': 'Performance', 'target.id': { $in: claimed.performanceIds } })
      }

      const filter: Record<string, any> = { status: 'pending' }
      if (!isAdmin) {
        if (targetClauses.length === 0) return []
        filter.$or = targetClauses
      }
      if (args.targetKind) filter['target.kind'] = args.targetKind
      if (args.authorType) filter['proposer.kind'] = args.authorType
      if (args.sinceDays && Number.isFinite(args.sinceDays)) {
        const since = new Date(Date.now() - args.sinceDays * 24 * 60 * 60 * 1000)
        filter.createdAt = { $gte: since }
      }

      const rows = await ProposalModel.find(filter)
        .sort({ createdAt: -1 })
        .limit(200)
        .lean()

      // Restore `id` field for graphql-relay globalIdField.
      for (const r of rows as any[]) {
        if (r && r._id && !r.id) r.id = r._id.toString()
      }
      return rows
    }
  },

  pendingProposalsForTarget: {
    type: new GraphQLList(proposalType),
    description: 'Pending proposals targeting a specific entity. Used by the in-context strip on detail pages.',
    args: {
      targetKind: { type: new GraphQLNonNull(GraphQLString) },
      targetId: { type: new GraphQLNonNull(GraphQLString) },
    },
    resolve: async (_: any, args: any) => {
      const rows = await ProposalModel.find({
        'target.kind': args.targetKind,
        'target.id': args.targetId,
        status: 'pending',
      })
        .sort({ createdAt: -1 })
        .limit(50)
        .lean()
      for (const r of rows as any[]) {
        if (r && r._id && !r.id) r.id = r._id.toString()
      }
      return rows
    }
  },
}
