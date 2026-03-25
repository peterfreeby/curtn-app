import { GraphQLFieldConfig, GraphQLString } from 'graphql'
import { connectionArgs, connectionFromArray } from 'graphql-relay'
import { ListConnection } from '../listTypes'
import { ListModel } from '../listModel'

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

    const lists = await ListModel.find(filter).sort({ createdAt: -1 }).limit(100)
    return connectionFromArray(lists, connArgs)
  }
}
