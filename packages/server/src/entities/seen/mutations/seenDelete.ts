import {
  GraphQLBoolean,
  GraphQLID,
  GraphQLInt,
  GraphQLNonNull
} from 'graphql'
import {
  fromGlobalId,
  mutationWithClientMutationId
} from 'graphql-relay'
import { SeenModel } from '../seenModel'
import { errorField } from '../../../graphql/errorField'

export const seenDelete = mutationWithClientMutationId({
  name: 'seenDelete',
  description: 'Remove a seen mark from a run',
  inputFields: {
    runId: {
      type: new GraphQLNonNull(GraphQLID),
      description: 'The global ID of the run to unmark'
    }
  },
  outputFields: {
    seen: {
      type: GraphQLBoolean,
      resolve: response => response.seen
    },
    seenCount: {
      type: GraphQLInt,
      resolve: response => response.seenCount
    },
    ...errorField
  },
  mutateAndGetPayload: async ({ runId }, ctx) => {
    if (!ctx.user) {
      return { seen: false, error: 'Unauthorized' }
    }

    const { id: targetRunId } = fromGlobalId(runId)

    await SeenModel.deleteOne({ user: ctx.user.id, run: targetRunId })

    const seenCount = await SeenModel.countDocuments({ run: targetRunId })

    return { seen: false, seenCount }
  }
})
