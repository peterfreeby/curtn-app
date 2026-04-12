import { GraphQLFieldConfig, GraphQLString } from 'graphql'
import { connectionArgs } from 'graphql-relay'
import { SeenConnection } from '../seenTypes'
import { SeenModel } from '../seenModel'
import { UserModel } from '../../user/userModel'
import { applyCursorToQuery, buildConnection } from '../../../graphql/cursorPagination'

export const seenList: GraphQLFieldConfig<any, any> = {
  type: SeenConnection,
  description: 'List seen records, optionally filtered by username',
  args: {
    ...connectionArgs,
    username: {
      type: GraphQLString,
      description: 'Filter by username'
    }
  },
  resolve: async (_root, args, ctx) => {
    const filter: any = {}

    if (args.username) {
      const user = await UserModel.findOne({ username: args.username })
      if (!user) return { edges: [], pageInfo: { hasNextPage: false, hasPreviousPage: false } }
      filter.user = user._id
    }

    const { filter: cursorFilter, sort, limit } = applyCursorToQuery(filter, {
      after: args.after,
      first: args.first,
      sortField: 'createdAt',
      sortDirection: -1,
      maxLimit: 50
    })

    const docs = await SeenModel.find(cursorFilter).sort(sort).limit(limit).lean()
    return buildConnection(docs, { first: args.first, sortField: 'createdAt', maxLimit: 50 })
  }
}
