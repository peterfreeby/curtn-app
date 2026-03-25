import { GraphQLBoolean, GraphQLFieldConfig, GraphQLString } from 'graphql'
import { connectionArgs, connectionFromArray } from 'graphql-relay'
import { ListConnection } from '../listTypes'
import { ListModel } from '../listModel'

export const editorialLists: GraphQLFieldConfig<any, any, any> = {
  type: ListConnection,
  args: {
    ...connectionArgs,
    listType: {
      type: GraphQLString,
      description: 'Filter by list type'
    },
    activeOnly: {
      type: GraphQLBoolean,
      description: 'If true, only return lists where isActive is true'
    }
  },
  resolve: async (_, args) => {
    const { listType, activeOnly, ...connArgs } = args
    const filter: any = { isEditorial: true }

    if (listType) {
      filter.listType = listType
    }

    if (activeOnly) {
      filter.isActive = true
    }

    const lists = await ListModel.find(filter).sort({ displayOrder: 1 }).limit(50)
    return connectionFromArray(lists, connArgs)
  }
}
