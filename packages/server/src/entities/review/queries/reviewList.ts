import { GraphQLFieldConfig, GraphQLFieldConfigArgumentMap, GraphQLID, GraphQLInt, GraphQLString } from 'graphql'
import { ReviewConnection } from '../reviewTypes'
import { ReviewModel } from '../reviewModel'
import { connectionArgs, connectionFromArray, fromGlobalId } from 'graphql-relay'
import { UserModel } from '../../user/userModel'
import { Types } from 'mongoose'

const usernameToObjectID = async (username: string): Promise<Types.ObjectId | undefined> => {
  const user = await UserModel.findOne({ username })

  return user?._id
}

type Args = GraphQLFieldConfigArgumentMap & {
  sort?: string
  rating?: number
  direction?: -1 | 1,
  performance?: string
  runId?: string
  username?: string
}

export const reviewList: GraphQLFieldConfig<any, any, Args> = {
  type: ReviewConnection,
  args: {
    ...connectionArgs,
    sort: {
      type: GraphQLString,
      description: 'Sort reviews by this field'
    },
    direction: {
      type: GraphQLString,
      description: 'Use the sort field in this direction'
    },
    rating: {
      type: GraphQLInt,
      description: 'Filter reviews by this rating'
    },
    performance: {
      type: GraphQLID,
      description: 'Filter reviews by this performance (showing)'
    },
    runId: {
      type: GraphQLID,
      description: 'Filter reviews by this run'
    },
    username: {
      type: GraphQLString,
      description: 'Filter reviews by this username'
    }
  },
  resolve: async (_, args) => {
    const { sort, rating, direction, performance, runId, username, ...connnectionArgs } = args

    const performanceId = performance && new Types.ObjectId(fromGlobalId(performance).id)
    const runObjectId = runId && new Types.ObjectId(fromGlobalId(runId).id)
    const userId = username && await usernameToObjectID(username)

    const filter = {
      ...(userId && { user: userId }),
      ...(performanceId && { performance: performanceId }),
      ...(runObjectId && { run: runObjectId }),
      ...(rating && { rating })
    }

    const reviews = await ReviewModel.aggregate([
      { $match: filter },
      { $sort: { [sort || 'createdAt']: direction || -1 } }
    ])

    return connectionFromArray(reviews, connnectionArgs)
  }
}
