import { GraphQLString } from 'graphql'
import { connectionArgs, connectionFromArray } from 'graphql-relay'
import { RemovalRequestConnection } from '../removalRequestTypes'
import { RemovalRequestModel } from '../removalRequestModel'
import { UserModel } from '../../user/userModel'

export const removalRequestQueries = {
  pendingRemovalRequests: {
    type: RemovalRequestConnection,
    description: 'Admin: all pending removal requests, newest first.',
    args: {
      ...connectionArgs,
      status: { type: GraphQLString, description: 'Filter by status; default = pending.' }
    },
    resolve: async (_: any, args: any, ctx: any) => {
      const empty = { edges: [], pageInfo: { hasNextPage: false, hasPreviousPage: false, startCursor: null, endCursor: null } }
      if (!ctx.user) return empty
      const adminUser = await UserModel.findById(ctx.user.id).select('isAdmin').lean()
      if (!adminUser?.isAdmin) return empty

      const status = args.status || 'pending'
      const rows = await RemovalRequestModel.find({ status }).sort({ createdAt: -1 }).limit(200).lean()
      for (const r of rows) {
        if (r && r._id && !(r as any).id) (r as any).id = r._id.toString()
      }
      return connectionFromArray(rows, args)
    }
  }
}
