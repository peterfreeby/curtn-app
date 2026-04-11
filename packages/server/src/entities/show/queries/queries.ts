import { GraphQLFieldConfig, GraphQLID, GraphQLList, GraphQLNonNull, GraphQLString } from 'graphql'
import { ShowConnection, showType } from '../showTypes'
import { ShowModel } from '../showModel'
import { connectionArgs, connectionFromArray, fromGlobalId } from 'graphql-relay'
import { applyCursorToQuery, buildConnection, connectionFromArrayLean } from '../../../graphql/cursorPagination'

export const singleShow: GraphQLFieldConfig<any, any, { id: string }> = {
  type: showType,
  args: {
    id: {
      type: new GraphQLNonNull(GraphQLID),
      description: 'Show ID'
    }
  },
  resolve: async (_, args) => {
    try {
      const { id } = fromGlobalId(args.id)
      return await ShowModel.findById(id)
    } catch {
      return null
    }
  }
}

export const showList: GraphQLFieldConfig<any, any, any> = {
  type: ShowConnection,
  args: {
    ...connectionArgs,
    performanceTypes: {
      type: new GraphQLList(GraphQLString),
      description: 'Filter by performance types'
    },
    search: {
      type: GraphQLString,
      description: 'Search by title or description'
    }
  },
  resolve: async (_, args) => {
    const { performanceTypes, search, ...connArgs } = args
    const filter: any = {}

    if (performanceTypes && performanceTypes.length > 0) {
      filter.performanceTypes = { $in: performanceTypes }
    }

    if (search) {
      filter.$text = { $search: search }
    }

    try {
      // Text search scores aren't stable across requests, so use connectionFromArray for search
      if (search) {
        const limit = (connArgs as any).first ?? 100
        const shows = await ShowModel.find(filter)
          .sort({ score: { $meta: 'textScore' } })
          .limit(limit)
          .lean()
        return connectionFromArrayLean(shows, connArgs)
      }

      // Non-search: proper cursor pagination
      const { filter: cursorFilter, sort, limit } = applyCursorToQuery(filter, {
        after: (connArgs as any).after,
        first: (connArgs as any).first,
        sortField: 'createdAt',
        sortDirection: -1
      })
      const shows = await ShowModel.find(cursorFilter).sort(sort).limit(limit).lean()
      return buildConnection(shows, { first: (connArgs as any).first, sortField: 'createdAt' })
    } catch (error) {
      console.error('Error fetching shows:', error)
      return { edges: [], pageInfo: { hasNextPage: false, hasPreviousPage: false, startCursor: null, endCursor: null } }
    }
  }
}

export const searchShows: GraphQLFieldConfig<any, any, { query: string }> = {
  type: ShowConnection,
  args: {
    ...connectionArgs,
    query: {
      type: new GraphQLNonNull(GraphQLString),
      description: 'Search query'
    }
  },
  resolve: async (_, args) => {
    const { query, ...connArgs } = args

    try {
      const shows = await ShowModel.find(
        { $text: { $search: query } },
        { score: { $meta: 'textScore' } }
      ).sort({ score: { $meta: 'textScore' } }).limit(50)

      return connectionFromArray(shows, connArgs)
    } catch (error) {
      console.error('Error searching shows:', error)
      return connectionFromArray([], connArgs)
    }
  }
}

export const showQueries = {
  singleShow,
  showList,
  searchShows
}
