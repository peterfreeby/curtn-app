import { GraphQLNonNull, GraphQLString } from 'graphql'
import { connectionArgs, connectionFromArray } from 'graphql-relay'
import { connectionFromArrayLean } from '../../../graphql/cursorPagination'
import { ClaimRequestConnection, claimRequestType } from '../claimRequestTypes'
import { ClaimRequestModel } from '../claimRequestModel'
import { UserModel } from '../../user/userModel'
import { myDashboardQueries } from './myDashboardQueries'
import { computeAutoPromotionScore } from '../../../services/verificationSignals/computeAutoPromotionScore'

export const claimRequestQueries = {
  ...myDashboardQueries,
  claimRequests: {
    type: ClaimRequestConnection,
    args: {
      status: { type: GraphQLString, description: 'Filter by status (pending, approved, rejected)' },
      ...connectionArgs
    },
    resolve: async (_: any, args: any, ctx: any) => {
      if (!ctx.user) return { edges: [], pageInfo: { hasNextPage: false, hasPreviousPage: false } }
      const adminUser = await UserModel.findById(ctx.user.id)
      if (!adminUser?.isAdmin) return { edges: [], pageInfo: { hasNextPage: false, hasPreviousPage: false } }

      const query: any = {}
      if (args.status) query.status = args.status

      const items = await ClaimRequestModel.find(query).sort({ requestedAt: -1 }).limit(200).lean()
      return connectionFromArrayLean(items, args)
    }
  },
  myClaimRequest: {
    type: claimRequestType,
    description: 'The current user\'s most recent pending claim request, or null',
    resolve: async (_: any, _args: any, ctx: any) => {
      if (!ctx.user) return null
      return ClaimRequestModel.findOne({ user: ctx.user.id, status: 'pending' }).sort({ requestedAt: -1 })
    }
  },
  // Phase 8 — live signals lookup for the claim form. Recomputes the
  // current score on demand so the "X / 100" counter updates as signals
  // are added.
  getClaimSignals: {
    type: claimRequestType,
    description: 'Fetch a ClaimRequest with freshly-computed verification signals (Phase 8).',
    args: { claimRequestId: { type: new GraphQLNonNull(GraphQLString) } },
    resolve: async (_: any, args: any, ctx: any) => {
      if (!ctx.user) return null
      const claim = await ClaimRequestModel.findById(args.claimRequestId)
      if (!claim) return null
      // Owner or admin only.
      const me = await UserModel.findById(ctx.user.id)
      if (claim.user.toString() !== ctx.user.id.toString() && !me?.isAdmin) return null
      const breakdown = await computeAutoPromotionScore(claim)
      if (!claim.signals) (claim as any).signals = {}
      claim.signals.autoPromotionScore = breakdown.total
      // Don't await save — caller doesn't need to wait, but persist for admin.
      await claim.save()
      return claim
    },
  },
  // Phase 8 — admin tab: auto-promoted claims.
  autoPromotedClaims: {
    type: ClaimRequestConnection,
    args: { ...connectionArgs },
    resolve: async (_: any, args: any, ctx: any) => {
      if (!ctx.user) return { edges: [], pageInfo: { hasNextPage: false, hasPreviousPage: false } }
      const me = await UserModel.findById(ctx.user.id)
      if (!me?.isAdmin) return { edges: [], pageInfo: { hasNextPage: false, hasPreviousPage: false } }
      const items = await ClaimRequestModel.find({ 'signals.autoPromotedAt': { $ne: null } })
        .sort({ 'signals.autoPromotedAt': -1 })
        .limit(200)
        .lean()
      return connectionFromArrayLean(items, args)
    },
  },
}
