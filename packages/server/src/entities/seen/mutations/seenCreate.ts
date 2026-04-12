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
import { ReviewModel } from '../../review/reviewModel'
import { RunModel } from '../../run/runModel'
import { errorField } from '../../../graphql/errorField'

export const seenCreate = mutationWithClientMutationId({
  name: 'seenCreate',
  description: 'Mark a run as seen',
  inputFields: {
    runId: {
      type: new GraphQLNonNull(GraphQLID),
      description: 'The global ID of the run to mark as seen'
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

    // Check if user already has a full review for this run
    const existingReview = await ReviewModel.findOne({ user: ctx.user.id, run: targetRunId })
    if (existingReview) {
      return { seen: true, error: 'You already have a review for this run' }
    }

    // Look up the run to get the show ID for denormalization
    const run = await RunModel.findById(targetRunId)
    if (!run) {
      return { seen: false, error: 'Run not found' }
    }

    await SeenModel.findOneAndUpdate(
      { user: ctx.user.id, run: targetRunId },
      { user: ctx.user.id, run: targetRunId, show: run.show },
      { upsert: true, new: true }
    )

    const seenCount = await SeenModel.countDocuments({ run: targetRunId })

    return { seen: true, seenCount }
  }
})
