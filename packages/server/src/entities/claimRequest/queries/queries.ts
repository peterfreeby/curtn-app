import { GraphQLString } from 'graphql'
import { connectionArgs, connectionFromArray } from 'graphql-relay'
import { connectionFromArrayLean } from '../../../graphql/cursorPagination'
import { ClaimRequestConnection, claimRequestType } from '../claimRequestTypes'
import { ClaimRequestModel } from '../claimRequestModel'
import { UserModel } from '../../user/userModel'

export const claimRequestQueries = {
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
  }
}
