import { GraphQLFieldConfig, GraphQLString } from 'graphql'
import { PersonConnection } from '../personTypes'
import { PersonModel } from '../personModel'
import { connectionArgs, connectionFromArray } from 'graphql-relay'
import { applyCursorToQuery, buildConnection, connectionFromArrayLean } from '../../../graphql/cursorPagination'

export const personList: GraphQLFieldConfig<any, any, any> = {
  type: PersonConnection,
  args: {
    ...connectionArgs,
    search: {
      type: GraphQLString,
      description: 'Search by name'
    }
  },
  resolve: async (_, args) => {
    const { search, ...connArgs } = args
    const filter: any = {}

    if (search) {
      filter.$text = { $search: search }
    }

    const empty = { edges: [], pageInfo: { hasNextPage: false, hasPreviousPage: false, startCursor: null, endCursor: null } }
    try {
      if (search) {
        const limit = (connArgs as any).first ?? 100
        const people = await PersonModel.find(filter)
          .sort({ score: { $meta: 'textScore' } })
          .limit(limit)
          .lean()
        return connectionFromArrayLean(people, connArgs)
      }

      const { filter: cursorFilter, sort, limit } = applyCursorToQuery(filter, {
        after: (connArgs as any).after,
        first: (connArgs as any).first,
        sortField: 'name',
        sortDirection: 1
      })
      const people = await PersonModel.find(cursorFilter).sort(sort).limit(limit).lean()
      return buildConnection(people, { first: (connArgs as any).first, sortField: 'name' })
    } catch (error) {
      console.error('Error fetching people:', error)
      return empty
    }
  }
}
