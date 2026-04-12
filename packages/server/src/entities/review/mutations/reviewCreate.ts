import {
  fromGlobalId,
  mutationWithClientMutationId
} from 'graphql-relay'
import { IReview, ReviewModel } from '../reviewModel'
import { reviewInputType, reviewType } from '../reviewTypes'
import { BetaMongoose2GQLInput } from '../../../types/types'
import { errorField } from '../../../graphql/errorField'
import { SeenModel } from '../../seen/seenModel'

type Review = BetaMongoose2GQLInput<IReview>

export const reviewCreate = mutationWithClientMutationId({
  name: 'reviewCreate',
  description: 'Add a review',
  inputFields: {
    ...reviewInputType
  },
  outputFields: {
    review: {
      type: reviewType,
      resolve: response => response.review
    },
    ...errorField
  },
  mutateAndGetPayload: async ({ ...review }: Review, ctx) => {
    if (!ctx.user) {
      return {
        error: 'Unauthorized',
        review: null
      }
    }

    const performanceId = fromGlobalId(review.performance).id
    const runId = fromGlobalId(review.run).id
    const user = ctx.user.id

    try {
      const document = await new ReviewModel({
        ...review,
        user,
        performance: performanceId,
        run: runId
      }).save()

      // Promote: if user had a Seen for this run, remove it
      await SeenModel.deleteOne({ user, run: runId })

      return {
        review: document
      }
    } catch {
      return {
        error: 'Invalid review'
      }
    }
  }
})
