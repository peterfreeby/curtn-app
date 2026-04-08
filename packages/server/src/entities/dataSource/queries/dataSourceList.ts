import { GraphQLFieldConfig } from 'graphql'
import { connectionArgs } from 'graphql-relay'
import { DataSourceConnection } from '../dataSourceTypes'
import { DataSourceModel } from '../dataSourceModel'
import { UserModel } from '../../user/userModel'
import { applyCursorToQuery, buildConnection } from '../../../graphql/cursorPagination'

export const dataSourceList: GraphQLFieldConfig<any, any> = {
  type: DataSourceConnection,
  description: 'List all data sources (admin only)',
  args: connectionArgs,
  resolve: async (_root, args, ctx) => {
    if (!ctx.user) throw new Error('Unauthorized')

    const adminUser = await UserModel.findById(ctx.user.id)
    if (!adminUser?.isAdmin) throw new Error('Admin access required')

    const { filter, sort, limit } = applyCursorToQuery({}, {
      after: args.after,
      first: args.first,
      sortField: 'createdAt',
      sortDirection: -1,
      maxLimit: 200
    })
    const dataSources = await DataSourceModel.find(filter).sort(sort).limit(limit).lean()
    return buildConnection(dataSources, { first: args.first, sortField: 'createdAt', maxLimit: 200 })
  }
}
