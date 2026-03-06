import { GraphQLFieldConfig } from 'graphql'
import { connectionArgs, connectionFromArray } from 'graphql-relay'
import { DataSourceConnection } from '../dataSourceTypes'
import { DataSourceModel } from '../dataSourceModel'
import { UserModel } from '../../user/userModel'

export const dataSourceList: GraphQLFieldConfig<any, any> = {
  type: DataSourceConnection,
  description: 'List all data sources (admin only)',
  args: connectionArgs,
  resolve: async (_root, args, ctx) => {
    if (!ctx.user) throw new Error('Unauthorized')

    const adminUser = await UserModel.findById(ctx.user.id)
    if (!adminUser?.isAdmin) throw new Error('Admin access required')

    const dataSources = await DataSourceModel.find().sort({ createdAt: -1 })
    return connectionFromArray(dataSources, args)
  }
}
