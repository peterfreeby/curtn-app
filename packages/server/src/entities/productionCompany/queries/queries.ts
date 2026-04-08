import { GraphQLFieldConfig, GraphQLID, GraphQLNonNull, GraphQLString } from 'graphql'
import { ProductionCompanyConnection, productionCompanyType } from '../productionCompanyTypes'
import { ProductionCompanyModel } from '../productionCompanyModel'
import { connectionArgs, connectionFromArray, fromGlobalId } from 'graphql-relay'
import { applyCursorToQuery, buildConnection, connectionFromArrayLean } from '../../../graphql/cursorPagination'

export const singleProductionCompany: GraphQLFieldConfig<any, any, { id: string }> = {
  type: productionCompanyType,
  args: {
    id: {
      type: new GraphQLNonNull(GraphQLID),
      description: 'ProductionCompany ID'
    }
  },
  resolve: async (_, args) => {
    try {
      const { id } = fromGlobalId(args.id)
      return await ProductionCompanyModel.findById(id)
    } catch {
      return null
    }
  }
}

export const productionCompanyBySlug: GraphQLFieldConfig<any, any, { slug: string }> = {
  type: productionCompanyType,
  args: {
    slug: {
      type: new GraphQLNonNull(GraphQLString),
      description: 'Company slug'
    }
  },
  resolve: async (_, args) => {
    try {
      return await ProductionCompanyModel.findOne({ slug: args.slug })
    } catch {
      return null
    }
  }
}

export const productionCompanyList: GraphQLFieldConfig<any, any, any> = {
  type: ProductionCompanyConnection,
  args: {
    ...connectionArgs,
    search: {
      type: GraphQLString,
      description: 'Search by name or description'
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
        const companies = await ProductionCompanyModel.find(filter)
          .sort({ score: { $meta: 'textScore' } })
          .limit(limit)
          .lean()
        return connectionFromArrayLean(companies, connArgs)
      }

      const { filter: cursorFilter, sort, limit } = applyCursorToQuery(filter, {
        after: (connArgs as any).after,
        first: (connArgs as any).first,
        sortField: 'name',
        sortDirection: 1
      })
      const companies = await ProductionCompanyModel.find(cursorFilter).sort(sort).limit(limit).lean()
      return buildConnection(companies, { first: (connArgs as any).first, sortField: 'name' })
    } catch (error) {
      console.error('Error fetching production companies:', error)
      return empty
    }
  }
}

export const productionCompanyQueries = {
  singleProductionCompany,
  productionCompanyBySlug,
  productionCompanyList
}
