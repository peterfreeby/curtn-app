import { GraphQLFieldConfig, GraphQLID, GraphQLNonNull } from 'graphql'
import { connectionArgs, connectionFromArray, fromGlobalId } from 'graphql-relay'
import { ListConnection } from '../listTypes'
import { ListModel } from '../listModel'
import { applyCursorToQuery, buildConnection } from '../../../graphql/cursorPagination'

export const userLists: GraphQLFieldConfig<any, any, any> = {
  type: ListConnection,
  args: {
    ...connectionArgs,
    userId: {
      type: new GraphQLNonNull(GraphQLID),
      description: 'Global ID of the user'
    }
  },
  resolve: async (_, args) => {
    const { userId, ...connArgs } = args

    try {
      const { id } = fromGlobalId(userId)
      const { filter, sort, limit } = applyCursorToQuery({ owner: id, isPublic: true }, {
        after: (connArgs as any).after,
        first: (connArgs as any).first,
        sortField: 'createdAt',
        sortDirection: -1
      })
      const lists = await ListModel.find(filter).sort(sort).limit(limit).lean()

      return buildConnection(lists, { first: (connArgs as any).first, sortField: 'createdAt' })
    } catch {
      return connectionFromArray([], connArgs)
    }
  }
}
