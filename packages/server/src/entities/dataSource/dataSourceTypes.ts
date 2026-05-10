import {
  GraphQLBoolean,
  GraphQLString,
  GraphQLNonNull,
  GraphQLObjectType
} from 'graphql'
import { connectionDefinitions, globalIdField } from 'graphql-relay'
import { nodeInterface } from '../../graphql/nodeInterface'
import { entityRegister } from '../../graphql/entityHelpers'
import { DataSourceModel } from './dataSourceModel'

export const dataSourceType = new GraphQLObjectType({
  name: 'DataSource',
  description: 'A data partner or feed (CSV upload, RSS, iCal, API, etc.)',
  interfaces: () => [nodeInterface],
  fields: () => ({
    id: globalIdField('DataSource', ds => ds._id),
    name: {
      type: new GraphQLNonNull(GraphQLString),
      resolve: ds => ds.name
    },
    type: {
      type: new GraphQLNonNull(GraphQLString),
      resolve: ds => ds.type
    },
    url: {
      type: GraphQLString,
      resolve: ds => ds.url
    },
    config: {
      type: GraphQLString,
      description: 'Cleanup rules as JSON string',
      resolve: ds => ds.config ? JSON.stringify(ds.config) : null
    },
    associatedVenue: {
      type: GraphQLString,
      description: 'Associated venue ID',
      resolve: ds => ds.associatedVenue?.toString()
    },
    associatedCompany: {
      type: GraphQLString,
      description: 'Associated production company ID',
      resolve: ds => ds.associatedCompany?.toString()
    },
    associatedShow: {
      type: GraphQLString,
      description: 'Associated show ID',
      resolve: ds => ds.associatedShow?.toString()
    },
    associatedRun: {
      type: GraphQLString,
      description: 'Associated run ID',
      resolve: ds => ds.associatedRun?.toString()
    },
    lastPolledAt: {
      type: GraphQLString,
      resolve: ds => ds.lastPolledAt?.toISOString()
    },
    healthStatus: {
      type: GraphQLString,
      description: "'healthy' or 'needs-attention' based on recent template fill rates",
      resolve: ds => ds.healthStatus || null
    },
    healthReason: {
      type: GraphQLString,
      description: 'Explanation when healthStatus is needs-attention',
      resolve: ds => ds.healthReason || null
    },
    isActive: {
      type: new GraphQLNonNull(GraphQLBoolean),
      resolve: ds => ds.isActive
    },
    createdBy: {
      type: GraphQLString,
      resolve: ds => ds.createdBy?.toString()
    },
    createdAt: {
      type: GraphQLString,
      resolve: ds => ds.createdAt?.toISOString()
    },
    updatedAt: {
      type: GraphQLString,
      resolve: ds => ds.updatedAt?.toISOString()
    }
  })
})

export const { connectionType: DataSourceConnection, edgeType: DataSourceEdge } = connectionDefinitions({
  nodeType: dataSourceType
})

entityRegister({
  type: dataSourceType,
  nodeResolver: async (id) => await DataSourceModel.findById(id)
})
