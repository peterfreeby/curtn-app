import {
  GraphQLBoolean,
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
import { RunModel } from '../run/runModel'
import { FollowModel } from '../follow/followModel'
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
  fields: () => {
    const { runType } = require('../run/runTypes')
    return {
      id: globalIdField('UserReview', review => review._id),
      user: {
        type: new GraphQLNonNull(userType),
        description: `The user who wrote the review`,
        resolve: async (review: any, _args: any, ctx: any) => {
          if (ctx.loaders) return ctx.loaders.userLoader.load(review.user.toString())
          return UserModel.findOne({ _id: review.user })
        }
      },
      performance: {
        type: new GraphQLNonNull(performanceType),
        description: `The specific showing reviewed`,
        resolve: async (review: any, _args: any, ctx: any) => {
          if (ctx.loaders) return ctx.loaders.performanceLoader.load(review.performance.toString())
          return PerformanceModel.findById(review.performance)
        }
      },
      run: {
        type: runType,
        description: `The run this review belongs to`,
        resolve: async (review: any, _args: any, ctx: any) => {
          if (!review.run) return null
          if (ctx.loaders) return ctx.loaders.runLoader.load(review.run.toString())
          return RunModel.findById(review.run)
        }
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
      isFollowedByViewer: {
        type: GraphQLBoolean,
        description: 'Whether the current viewer follows this review author',
        resolve: async (review: any, _args: any, ctx: any) => {
          if (!ctx.user || ctx.user.id === String(review.user)) return false
          const doc = await FollowModel.findOne({ follower: ctx.user.id, following: review.user })
          return !!doc
        }
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
    }
  }
})

export const reviewInputType: ThunkObjMap<GraphQLInputFieldConfig> = {
  performance: {
    type: new GraphQLNonNull(GraphQLID),
    description: `Performance (showing) unique identifier`
  },
  run: {
    type: new GraphQLNonNull(GraphQLID),
    description: `Run unique identifier`
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
