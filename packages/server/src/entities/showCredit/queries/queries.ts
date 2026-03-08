import { GraphQLFieldConfig, GraphQLID, GraphQLNonNull } from 'graphql'
import { ShowCreditConnection } from '../showCreditTypes'
import { ShowCreditModel } from '../showCreditModel'
import { fromGlobalId } from 'graphql-relay'

export const showCreditsByShow: GraphQLFieldConfig<any, any, any> = {
  type: ShowCreditConnection,
  args: {
    showId: {
      type: new GraphQLNonNull(GraphQLID),
      description: 'Show GlobalID'
    }
  },
  resolve: async (_, args) => {
    try {
      const { id } = fromGlobalId(args.showId)
      const showCredits = await ShowCreditModel.find({ show: id }).sort({ order: 1 })
      return {
        edges: showCredits.map(sc => ({ node: sc, cursor: sc._id.toString() })),
        pageInfo: { hasNextPage: false, hasPreviousPage: false }
      }
    } catch {
      return { edges: [], pageInfo: { hasNextPage: false, hasPreviousPage: false } }
    }
  }
}

export const showCreditQueries = {
  showCreditsByShow
}
