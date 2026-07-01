import { GraphQLBoolean, GraphQLFieldConfig, GraphQLString } from 'graphql'
import { connectionArgs } from 'graphql-relay'
import { ListConnection } from '../listTypes'
import { ListModel } from '../listModel'
import { applyCursorToQuery, buildConnection } from '../../../graphql/cursorPagination'

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
    },
    isActive: {
      type: GraphQLBoolean,
      description: 'If provided, filter by exact active state (true = active, false = inactive)'
    }
  },
  resolve: async (_, args) => {
    const { listType, activeOnly, isActive, ...connArgs } = args
    const filter: any = { isEditorial: true }

    if (listType) {
      filter.listType = listType
    }

    if (activeOnly) {
      filter.isActive = true
    } else if (typeof isActive === 'boolean') {
      filter.isActive = isActive
    }

    const { filter: cursorFilter, sort, limit } = applyCursorToQuery(filter, {
      after: (connArgs as any).after,
      first: (connArgs as any).first,
      sortField: 'displayOrder',
      sortDirection: 1,
      maxLimit: 200
    })
    const lists = await ListModel.find(cursorFilter).sort(sort).limit(limit).lean()
    return buildConnection(lists, { first: (connArgs as any).first, sortField: 'displayOrder', maxLimit: 50 })
  }
}
