import {
  GraphQLString,
  GraphQLNonNull,
  GraphQLObjectType,
  GraphQLInt,
  GraphQLBoolean
} from 'graphql'
import { nodeInterface } from '../../graphql/nodeInterface'
import { globalIdField, connectionDefinitions } from 'graphql-relay'
import { entityRegister } from '../../graphql/entityHelpers'
import { StageModel } from './stageModel'

export const stageType = new GraphQLObjectType({
  name: 'Stage',
  description: 'A specific stage or performance space within a venue',
  interfaces: () => [nodeInterface],
  fields: () => {
    const { venueType } = require('../venue/venueTypes')
    const { VenueModel } = require('../venue/venueModel')

    return {
      id: globalIdField('Stage', stage => stage.id),
      name: {
        type: new GraphQLNonNull(GraphQLString),
        resolve: stage => stage.name
      },
      slug: {
        type: new GraphQLNonNull(GraphQLString),
        resolve: stage => stage.slug
      },
      venue: {
        type: new GraphQLNonNull(venueType),
        resolve: stage => VenueModel.findById(stage.venue)
      },
      isDefault: {
        type: new GraphQLNonNull(GraphQLBoolean),
        resolve: stage => stage.isDefault
      },
      capacity: {
        type: GraphQLInt,
        resolve: stage => stage.capacity
      },
      description: {
        type: GraphQLString,
        resolve: stage => stage.description
      },
      createdAt: {
        type: GraphQLString,
        resolve: stage => stage.createdAt?.toISOString()
      },
      updatedAt: {
        type: GraphQLString,
        resolve: stage => stage.updatedAt?.toISOString()
      }
    }
  }
})

export const { connectionType: StageConnection, edgeType: StageEdge } = connectionDefinitions({
  nodeType: stageType
})

entityRegister({
  type: stageType,
  nodeResolver: async (id) => await StageModel.findById(id)
})
