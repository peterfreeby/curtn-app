import { GraphQLBoolean, GraphQLInt, GraphQLList, GraphQLNonNull, GraphQLObjectType, GraphQLString } from 'graphql'
import { Types } from 'mongoose'
import { BlockModel } from '../blockModel'
import { blockType } from '../blockTypes'
import { UserModel } from '../../user/userModel'
import { ANTI_ABUSE } from '../../../permissions/antiAbuseConfig'

// Phase 7 — block queries.
//   blocksForUnit: claimant dashboard — blocks I've issued on a specific unit.
//   myIssuedBlocks: all active blocks I've issued, sorted recent-first.
//   adminBlockActivity: admin-only aggregate of platform block activity.

const topBlockerType = new GraphQLObjectType({
  name: 'TopBlocker',
  fields: () => ({
    blockerId: { type: new GraphQLNonNull(GraphQLString), resolve: (r: any) => r.blockerId },
    blockerUsername: { type: GraphQLString, resolve: (r: any) => r.blockerUsername ?? null },
    blockerFullName: { type: GraphQLString, resolve: (r: any) => r.blockerFullName ?? null },
    blockCount: { type: new GraphQLNonNull(GraphQLInt), resolve: (r: any) => r.blockCount },
    flagged: { type: new GraphQLNonNull(GraphQLBoolean), resolve: (r: any) => !!r.flagged },
  }),
})

const adminBlockActivityType = new GraphQLObjectType({
  name: 'AdminBlockActivity',
  fields: () => ({
    topBlockers: { type: new GraphQLNonNull(new GraphQLList(new GraphQLNonNull(topBlockerType))), resolve: (r: any) => r.topBlockers },
    recentBlocks: { type: new GraphQLNonNull(new GraphQLList(new GraphQLNonNull(blockType))), resolve: (r: any) => r.recentBlocks },
    windowDays: { type: new GraphQLNonNull(GraphQLInt), resolve: (r: any) => r.windowDays },
    threshold: { type: new GraphQLNonNull(GraphQLInt), resolve: (r: any) => r.threshold },
  }),
})

export const blockQueries = {
  blocksForUnit: {
    type: new GraphQLList(blockType),
    description: 'Active blocks the authenticated user has issued on a specific unit.',
    args: {
      scopedToKind: { type: new GraphQLNonNull(GraphQLString) },
      scopedToId: { type: new GraphQLNonNull(GraphQLString) },
      includeRevoked: { type: GraphQLBoolean },
    },
    resolve: async (_: any, args: any, ctx: any) => {
      if (!ctx.user) return []
      const filter: Record<string, any> = {
        blocker: new Types.ObjectId(ctx.user.id),
        'scopedTo.kind': args.scopedToKind,
        'scopedTo.id': new Types.ObjectId(args.scopedToId),
      }
      if (!args.includeRevoked) filter.revokedAt = null
      const rows = await BlockModel.find(filter).sort({ createdAt: -1 }).limit(200).lean()
      for (const r of rows as any[]) {
        if (r && r._id && !r.id) r.id = r._id.toString()
      }
      return rows
    },
  },

  myIssuedBlocks: {
    type: new GraphQLList(blockType),
    description: 'Active blocks the authenticated user has issued, across all units.',
    args: {
      includeRevoked: { type: GraphQLBoolean },
    },
    resolve: async (_: any, args: any, ctx: any) => {
      if (!ctx.user) return []
      const filter: Record<string, any> = { blocker: new Types.ObjectId(ctx.user.id) }
      if (!args.includeRevoked) filter.revokedAt = null
      const rows = await BlockModel.find(filter).sort({ createdAt: -1 }).limit(200).lean()
      for (const r of rows as any[]) {
        if (r && r._id && !r.id) r.id = r._id.toString()
      }
      return rows
    },
  },

  adminBlockActivity: {
    type: adminBlockActivityType,
    description: 'Admin-only aggregate of recent block activity. Surfaces high-volume blockers.',
    args: {
      windowDays: { type: GraphQLInt },
    },
    resolve: async (_: any, args: any, ctx: any) => {
      if (!ctx.user) return null
      const adminUser = await UserModel.findById(ctx.user.id).select('isAdmin').lean()
      if (!adminUser?.isAdmin) return null

      const windowDays = Number.isFinite(args.windowDays) && args.windowDays > 0
        ? args.windowDays
        : ANTI_ABUSE.BLOCK_VOLUME_ALERT_WINDOW_DAYS
      const since = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000)

      const grouped = await BlockModel.aggregate([
        { $match: { createdAt: { $gte: since } } },
        { $group: { _id: '$blocker', blockCount: { $sum: 1 } } },
        { $sort: { blockCount: -1 } },
        { $limit: 50 },
      ])

      const blockerIds = grouped.map(g => g._id).filter(Boolean)
      const users = blockerIds.length
        ? await UserModel.find({ _id: { $in: blockerIds } }).select('username fullName').lean()
        : []
      const userById: Record<string, any> = {}
      for (const u of users) userById[u._id.toString()] = u

      const topBlockers = grouped.map(g => {
        const u = userById[g._id?.toString?.()]
        return {
          blockerId: g._id?.toString?.() ?? '',
          blockerUsername: u?.username ?? null,
          blockerFullName: u?.fullName ?? null,
          blockCount: g.blockCount,
          flagged: g.blockCount > ANTI_ABUSE.BLOCK_VOLUME_ALERT_THRESHOLD,
        }
      })

      const recentBlocks = await BlockModel.find({ createdAt: { $gte: since } })
        .sort({ createdAt: -1 })
        .limit(50)
        .lean()
      for (const r of recentBlocks as any[]) {
        if (r && r._id && !r.id) r.id = r._id.toString()
      }

      return {
        topBlockers,
        recentBlocks,
        windowDays,
        threshold: ANTI_ABUSE.BLOCK_VOLUME_ALERT_THRESHOLD,
      }
    },
  },
}
