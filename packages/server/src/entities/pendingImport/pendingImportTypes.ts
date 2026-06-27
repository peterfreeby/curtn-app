import {
  GraphQLString,
  GraphQLNonNull,
  GraphQLObjectType,
  GraphQLInt,
  GraphQLList,
  GraphQLBoolean
} from 'graphql'
import { nodeInterface } from '../../graphql/nodeInterface'
import { globalIdField, connectionDefinitions } from 'graphql-relay'
import { entityRegister } from '../../graphql/entityHelpers'
import { PendingImportModel } from './pendingImportModel'

const creditEntryType = new GraphQLObjectType({
  name: 'PendingImportCredit',
  description: 'A cast or crew entry on a pending import (not yet promoted to a real Person record)',
  fields: () => ({
    name: { type: new GraphQLNonNull(GraphQLString), resolve: c => c.name },
    role: { type: GraphQLString, resolve: c => c.role },
    headshotUrl: { type: GraphQLString, resolve: c => c.headshotUrl }
  })
})

export const pendingImportType = new GraphQLObjectType({
  name: 'PendingImport',
  description: 'An event imported from a feed, awaiting admin review',
  interfaces: () => [nodeInterface],
  fields: () => {
    const { dataSourceType } = require('../dataSource/dataSourceTypes')
    const { DataSourceModel } = require('../dataSource/dataSourceModel')

    return {
      id: globalIdField('PendingImport', pi => pi.id),
      dataSource: {
        type: new GraphQLNonNull(dataSourceType),
        resolve: async (pi: any) => DataSourceModel.findById(pi.dataSource)
      },
      status: {
        type: new GraphQLNonNull(GraphQLString),
        resolve: pi => pi.status
      },
      title: {
        type: new GraphQLNonNull(GraphQLString),
        resolve: pi => pi.title
      },
      runTitle: {
        type: GraphQLString,
        resolve: pi => pi.runTitle
      },
      showDescription: {
        type: GraphQLString,
        resolve: pi => pi.showDescription
      },
      runDescription: {
        type: GraphQLString,
        resolve: pi => pi.runDescription
      },
      performanceDescription: {
        type: GraphQLString,
        resolve: pi => pi.performanceDescription
      },
      performanceTypes: {
        type: new GraphQLList(GraphQLString),
        resolve: pi => pi.performanceTypes
      },
      duration: {
        type: GraphQLInt,
        resolve: pi => pi.duration
      },
      date: {
        type: GraphQLString,
        resolve: pi => pi.date?.toISOString()
      },
      time: {
        type: GraphQLString,
        resolve: pi => pi.time
      },
      venueName: {
        type: GraphQLString,
        resolve: pi => pi.venueName
      },
      stageName: {
        type: GraphQLString,
        resolve: pi => pi.stageName
      },
      companyName: {
        type: GraphQLString,
        resolve: pi => pi.companyName
      },
      ticketUrl: {
        type: GraphQLString,
        resolve: pi => pi.ticketUrl
      },
      imageUrl: {
        type: GraphQLString,
        resolve: pi => pi.imageUrl
      },
      cast: {
        type: new GraphQLList(creditEntryType),
        resolve: pi => pi.cast || []
      },
      crew: {
        type: new GraphQLList(creditEntryType),
        resolve: pi => pi.crew || []
      },
      importedAt: {
        type: new GraphQLNonNull(GraphQLString),
        resolve: pi => pi.importedAt?.toISOString()
      },
      reviewedAt: {
        type: GraphQLString,
        resolve: pi => pi.reviewedAt?.toISOString()
      },
      error: {
        type: GraphQLString,
        resolve: pi => pi.error
      },
      createdAt: {
        type: GraphQLString,
        resolve: pi => pi.createdAt?.toISOString()
      }
    }
  }
})

export const { connectionType: PendingImportConnection, edgeType: PendingImportEdge } = connectionDefinitions({
  nodeType: pendingImportType,
  connectionFields: {
    // True count of all matching rows for the active filter (not just the
    // loaded page). Falls back to edge count if the resolver didn't set it.
    totalCount: {
      type: GraphQLInt,
      resolve: (conn: any) => conn.totalCount ?? conn.edges?.length ?? 0
    }
  }
})

entityRegister({
  type: pendingImportType,
  nodeResolver: async (id) => await PendingImportModel.findById(id)
})
