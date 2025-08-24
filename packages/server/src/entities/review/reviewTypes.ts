import {
  GraphQLID,
  GraphQLInt,
  ThunkObjMap,
  GraphQLFloat,
  GraphQLString,
  GraphQLNonNull,
  GraphQLObjectType,
  GraphQLInputFieldConfig
} from 'graphql'
import { userType } from '../user/userTypes'
import { performanceType } from '../performance/performanceTypes'
import { UserModel } from '../user/userModel'
import { PerformanceModel } from '../performance/performanceModel'
import { nodeInterface } from '../../graphql/nodeInterface'
import { entityRegister } from '../../graphql/entityHelpers'
import { connectionDefinitions, globalIdField, connectionFromArray, connectionArgs } from 'graphql-relay'
import { CommentConnection } from '../comment/commentTypes'
import { CommentModel } from '../comment/commentModel'
import { ReviewModel } from './reviewModel'

export const reviewType = new GraphQLObjectType({
  name: 'UserReview',
  description: `User's review of a specific performance`,
  interfaces: () => [nodeInterface],
  fields: () => ({
    id: globalIdField('UserReview', review => review._id),
    user: {
      type: new GraphQLNonNull(userType),
      description: `The user who wrote the review`,
      resolve: async review => {
        const user = await UserModel.findOne({
          _id: review.user
        })
        return user
      }
    },
    performance: {
      type: new GraphQLNonNull(performanceType),
      description: `The performance being reviewed`,
      resolve: async review => {
        const performance = await PerformanceModel.findById(review.performance)
        return performance
      }
    },
    performanceDate: {
      type: new GraphQLNonNull(GraphQLString),
      description: `Which specific performance date the user attended`,
      resolve: review => review.performanceDate.toISOString()
    },
    venue: {
      type: new GraphQLNonNull(GraphQLString),
      description: `Which venue the user saw the performance at`,
      resolve: review => review.venue
    },
    text: {
      type: GraphQLString,
      description: `User's review text`,
      resolve: review => review.text
    },
    rating: {
      type: new GraphQLNonNull(GraphQLFloat),
      description: `User's rating (0-5)`,
      resolve: review => review.rating
    },
    attendedAt: {
      type: new GraphQLNonNull(GraphQLString),
      description: `When the user attended the performance`,
      resolve: review => review.attendedAt.toISOString()
    },
    comments: {
      type: CommentConnection,
      args: {
        ...connectionArgs
      },
      description: `Comments on this review`,
      resolve: async (review, args) => {
        const comments = await CommentModel.find({ _id: { $in: review.comments } })
        return connectionFromArray(comments, args)
      }
    },
    totalComments: {
      type: GraphQLInt,
      description: `Total number of comments on this review`,
      resolve: review => review.comments.length
    },
    createdAt: {
      type: GraphQLString,
      description: `When the review was created`,
      resolve: review => review.createdAt?.toISOString()
    },
    updatedAt: {
      type: GraphQLString,
      description: `When the review was last updated`,
      resolve: review => review.updatedAt?.toISOString()
    }
  })
})

export const reviewInputType: ThunkObjMap<GraphQLInputFieldConfig> = {
  performance: {
    type: new GraphQLNonNull(GraphQLID),
    description: `Performance's unique identifier`
  },
  performanceDate: {
    type: new GraphQLNonNull(GraphQLString),
    description: `Which specific performance date attended (ISO date string)`
  },
  venue: {
    type: new GraphQLNonNull(GraphQLString),
    description: `Which venue the performance was seen at`
  },
  text: {
    type: GraphQLString,
    description: `Review text content`
  },
  rating: {
    type: new GraphQLNonNull(GraphQLFloat),
    description: `Rating from 0-5`
  },
  attendedAt: {
    type: new GraphQLNonNull(GraphQLString),
    description: `When the user attended the performance (ISO date string)`
  }
}

export const { connectionType: ReviewConnection, edgeType: ReviewEdge } = connectionDefinitions({
  nodeType: reviewType
})

entityRegister({
  type: reviewType,
  nodeResolver: async (id) => await ReviewModel.findById(id)
})