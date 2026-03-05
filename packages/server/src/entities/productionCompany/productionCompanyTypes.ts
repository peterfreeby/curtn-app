import {
  GraphQLList,
  GraphQLString,
  GraphQLNonNull,
  GraphQLObjectType
} from 'graphql'
import { nodeInterface } from '../../graphql/nodeInterface'
import { globalIdField, connectionDefinitions } from 'graphql-relay'
import { entityRegister } from '../../graphql/entityHelpers'
import { ProductionCompanyModel } from './productionCompanyModel'
import { RunModel } from '../run/runModel'
import { CreditModel } from '../credit/creditModel'
import { PersonModel } from '../person/personModel'
import { VenueModel } from '../venue/venueModel'
import { venueType } from '../venue/venueTypes'

export const productionCompanyType: GraphQLObjectType = new GraphQLObjectType({
  name: 'ProductionCompany',
  description: 'A production company or theater troupe',
  interfaces: () => [nodeInterface],
  fields: () => {
    const { RunConnection } = require('../run/runTypes')
    const { personType } = require('../person/personTypes')
    return {
      id: globalIdField('ProductionCompany', company => company.id),
      name: {
        type: new GraphQLNonNull(GraphQLString),
        resolve: company => company.name
      },
      slug: {
        type: new GraphQLNonNull(GraphQLString),
        resolve: company => company.slug
      },
      description: {
        type: GraphQLString,
        resolve: company => company.description
      },
      logoUrl: {
        type: GraphQLString,
        resolve: company => company.logoUrl
      },
      wikidataId: {
        type: GraphQLString,
        resolve: company => company.wikidataId
      },
      runs: {
        type: RunConnection,
        description: 'All runs by this company',
        resolve: async company => {
          const runs = await RunModel.find({ productionCompany: company._id }).sort({ startDate: -1 })
          return { edges: runs.map(r => ({ node: r, cursor: r._id.toString() })), pageInfo: { hasNextPage: false, hasPreviousPage: false } }
        }
      },
      venues: {
        type: new GraphQLList(venueType),
        description: 'Unique venues from all runs',
        resolve: async company => {
          const runs = await RunModel.find({ productionCompany: company._id })
          const venueIds = [...new Set(runs.flatMap(r => r.venues.map(v => v.toString())))]
          return await VenueModel.find({ _id: { $in: venueIds } })
        }
      },
      people: {
        type: new GraphQLList(personType),
        description: 'Unique people from all credits on runs',
        resolve: async company => {
          const runs = await RunModel.find({ productionCompany: company._id })
          const runIds = runs.map(r => r._id)
          const credits = await CreditModel.find({ run: { $in: runIds } })
          const personIds = [...new Set(credits.map(c => c.person.toString()))]
          return await PersonModel.find({ _id: { $in: personIds } })
        }
      },
      createdAt: {
        type: GraphQLString,
        resolve: company => company.createdAt?.toISOString()
      },
      updatedAt: {
        type: GraphQLString,
        resolve: company => company.updatedAt?.toISOString()
      }
    }
  }
})

export const { connectionType: ProductionCompanyConnection, edgeType: ProductionCompanyEdge } = connectionDefinitions({
  nodeType: productionCompanyType
})

entityRegister({
  type: productionCompanyType,
  nodeResolver: async (id) => await ProductionCompanyModel.findById(id)
})
