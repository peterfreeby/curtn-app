import { GraphQLFieldConfig, GraphQLID, GraphQLNonNull } from 'graphql'
import { ShowCompanyCreditConnection } from '../showCompanyCreditTypes'
import { ShowCompanyCreditModel } from '../showCompanyCreditModel'
import { fromGlobalId } from 'graphql-relay'

export const showCompanyCreditsByShow: GraphQLFieldConfig<any, any, any> = {
  type: ShowCompanyCreditConnection,
  args: {
    showId: {
      type: new GraphQLNonNull(GraphQLID),
      description: 'Show GlobalID'
    }
  },
  resolve: async (_, args) => {
    try {
      const { id } = fromGlobalId(args.showId)
      const credits = await ShowCompanyCreditModel.find({ show: id }).sort({ order: 1 })
      return {
        edges: credits.map(c => ({ node: c, cursor: c._id.toString() })),
        pageInfo: { hasNextPage: false, hasPreviousPage: false }
      }
    } catch {
      return { edges: [], pageInfo: { hasNextPage: false, hasPreviousPage: false } }
    }
  }
}

export const showCompanyCreditQueries = {
  showCompanyCreditsByShow
}
