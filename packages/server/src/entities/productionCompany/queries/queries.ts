import { GraphQLFieldConfig, GraphQLID, GraphQLNonNull, GraphQLString } from 'graphql'
import { ProductionCompanyConnection, productionCompanyType } from '../productionCompanyTypes'
import { ProductionCompanyModel } from '../productionCompanyModel'
import { connectionArgs, connectionFromArray, fromGlobalId } from 'graphql-relay'

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

    try {
      const companies = await ProductionCompanyModel.find(filter)
        .sort(search ? { score: { $meta: 'textScore' } } : { name: 1 })
        .limit(100)
      return connectionFromArray(companies, connArgs)
    } catch (error) {
      console.error('Error fetching production companies:', error)
      return connectionFromArray([], connArgs)
    }
  }
}

export const productionCompanyQueries = {
  singleProductionCompany,
  productionCompanyBySlug,
  productionCompanyList
}
