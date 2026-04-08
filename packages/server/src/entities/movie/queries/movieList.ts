import { GraphQLFieldConfig } from 'graphql'
import { MovieConnection } from '../movieTypes'
import { MovieModel } from '../movieModel'
import { connectionArgs } from 'graphql-relay'
import { applyCursorToQuery, buildConnection } from '../../../graphql/cursorPagination'

export const movieList: GraphQLFieldConfig<any, any, any> = {
  type: MovieConnection,
  args: connectionArgs,
  resolve: async (_, args) => {
    const { filter, sort, limit } = applyCursorToQuery({}, {
      after: args.after,
      first: args.first,
      sortField: 'createdAt',
      sortDirection: -1,
      maxLimit: 200
    })
    const movies = await MovieModel.find(filter).sort(sort).limit(limit).lean()
    return buildConnection(movies, { first: args.first, sortField: 'createdAt', maxLimit: 200 })
  }
}
