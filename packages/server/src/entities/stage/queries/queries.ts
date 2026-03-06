import { GraphQLString, GraphQLNonNull } from 'graphql'
import { connectionArgs, connectionFromArray } from 'graphql-relay'
import { StageConnection } from '../stageTypes'
import { StageModel } from '../stageModel'

export const stageQueries = {
  stagesByVenue: {
    type: StageConnection,
    args: {
      venueId: { type: new GraphQLNonNull(GraphQLString) },
      ...connectionArgs
    },
    resolve: async (_: any, args: any) => {
      const stages = await StageModel.find({ venue: args.venueId, isDefault: false }).sort({ name: 1 })
      return connectionFromArray(stages, args)
    }
  }
}
