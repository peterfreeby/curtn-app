import { GraphQLFieldConfig, GraphQLString } from 'graphql'
import { connectionArgs, connectionFromArray } from 'graphql-relay'
import { ListConnection } from '../listTypes'
import { ListModel } from '../listModel'
import { applyCursorToQuery, buildConnection } from '../../../graphql/cursorPagination'

export const myLists: GraphQLFieldConfig<any, any, any> = {
  type: ListConnection,
  args: {
    ...connectionArgs,
    listType: {
      type: GraphQLString,
      description: 'Filter by list type (shows, venues, runs, performances, people)'
    }
  },
  resolve: async (_, args, ctx) => {
    if (!ctx.user) {
      return connectionFromArray([], args)
    }

    const { listType, ...connArgs } = args
    const filter: any = {
      $or: [
        { owner: ctx.user.id },
        { collaborators: ctx.user.id }
      ]
    }

    if (listType) {
      filter.listType = listType
    }

    const { filter: cursorFilter, sort, limit } = applyCursorToQuery(filter, {
      after: (connArgs as any).after,
      first: (connArgs as any).first,
      sortField: 'createdAt',
      sortDirection: -1
    })
    const lists = await ListModel.find(cursorFilter).sort(sort).limit(limit).lean()
    return buildConnection(lists, { first: (connArgs as any).first, sortField: 'createdAt' })
  }
}
