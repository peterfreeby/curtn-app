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
  showId?: string
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
      description: 'Filter reviews by this run (aggregates all performances in that run)'
    },
    showId: {
      type: GraphQLID,
      description: 'Filter reviews by this show (aggregates all performances across all runs)'
    },
    username: {
      type: GraphQLString,
      description: 'Filter reviews by this username'
    }
  },
  resolve: async (_, args) => {
    const { sort, rating, direction, performance, runId, showId, username, ...connnectionArgs } = args

    const performanceId = performance && new Types.ObjectId(fromGlobalId(performance).id)
    const userId = username && await usernameToObjectID(username)

    // Build performance filter for run or show level aggregation
    let performanceFilter: { performance?: any } = {}
    if (performanceId) {
      performanceFilter = { performance: performanceId }
    } else if (runId) {
      const runObjectId = new Types.ObjectId(fromGlobalId(runId).id)
      const { PerformanceModel } = require('../../performance/performanceModel')
      const performances = await PerformanceModel.find({ run: runObjectId }, '_id')
      const perfIds = performances.map((p: any) => p._id)
      performanceFilter = { performance: { $in: perfIds } }
    } else if (showId) {
      const showObjectId = new Types.ObjectId(fromGlobalId(showId).id)
      const { RunModel } = require('../../run/runModel')
      const { PerformanceModel } = require('../../performance/performanceModel')
      const runs = await RunModel.find({ show: showObjectId }, '_id')
      const runIds = runs.map((r: any) => r._id)
      const performances = await PerformanceModel.find({ run: { $in: runIds } }, '_id')
      const perfIds = performances.map((p: any) => p._id)
      performanceFilter = { performance: { $in: perfIds } }
    }

    const filter = {
      ...(userId && { user: userId }),
      ...performanceFilter,
      ...(rating && { rating })
    }

    const reviews = await ReviewModel.aggregate([
      { $match: filter },
      { $sort: { [sort || 'createdAt']: direction || -1 } }
    ])

    return connectionFromArray(reviews, connnectionArgs)
  }
}
