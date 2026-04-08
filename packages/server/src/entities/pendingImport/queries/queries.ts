import { GraphQLString, GraphQLInt } from 'graphql'
import { connectionArgs, connectionFromArray } from 'graphql-relay'
import { connectionFromArrayLean } from '../../../graphql/cursorPagination'
import { PendingImportConnection } from '../pendingImportTypes'
import { PendingImportModel } from '../pendingImportModel'
import { UserModel } from '../../user/userModel'

export const pendingImportQueries = {
  pendingImports: {
    type: PendingImportConnection,
    args: {
      status: { type: GraphQLString, description: 'Filter by status (pending, approved, rejected)' },
      dataSourceId: { type: GraphQLString, description: 'Filter by data source' },
      ...connectionArgs
    },
    resolve: async (_: any, args: any, ctx: any) => {
      if (!ctx.user) return { edges: [], pageInfo: { hasNextPage: false, hasPreviousPage: false } }
      const adminUser = await UserModel.findById(ctx.user.id)
      if (!adminUser?.isAdmin) return { edges: [], pageInfo: { hasNextPage: false, hasPreviousPage: false } }

      const query: any = {}
      if (args.status) query.status = args.status
      if (args.dataSourceId) query.dataSource = args.dataSourceId

      const items = await PendingImportModel.find(query).sort({ importedAt: -1 }).limit(200).lean()
      return connectionFromArrayLean(items, args)
    }
  }
}
