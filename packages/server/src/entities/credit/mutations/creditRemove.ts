import { GraphQLID, GraphQLInt, GraphQLNonNull } from 'graphql'
import { fromGlobalId, mutationWithClientMutationId } from 'graphql-relay'
import { CreditModel } from '../creditModel'
import { errorField } from '../../../graphql/errorField'

export const creditRemove = mutationWithClientMutationId({
  name: 'creditRemove',
  description: 'Remove a credit from a run',
  inputFields: {
    creditId: {
      type: new GraphQLNonNull(GraphQLID),
      description: 'Credit ID to remove'
    }
  },
  outputFields: {
    deletedCount: {
      type: GraphQLInt,
      resolve: response => response.deletedCount
    },
    ...errorField
  },
  mutateAndGetPayload: async (input, ctx) => {
    if (!ctx.user) {
      return { error: 'Unauthorized', deletedCount: 0 }
    }

    try {
      const { id } = fromGlobalId(input.creditId)
      const result = await CreditModel.deleteOne({ _id: id })
      return { deletedCount: result.deletedCount }
    } catch {
      return { error: 'Failed to remove credit', deletedCount: 0 }
    }
  }
})
