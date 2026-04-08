import {
  GraphQLList,
  GraphQLString,
  GraphQLNonNull,
  GraphQLObjectType
} from 'graphql'
import { nodeInterface } from '../../graphql/nodeInterface'
import { globalIdField, connectionDefinitions, connectionArgs } from 'graphql-relay'
import { applyCursorToQuery, buildConnection } from '../../graphql/cursorPagination'
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
        args: { ...connectionArgs },
        resolve: async (company: any, args: any, ctx: any) => {
          if (!args.first && !args.after && ctx.loaders) {
            const runs = await ctx.loaders.runsByCompanyLoader.load(company._id.toString())
            return { edges: runs.map((r: any) => ({ node: r, cursor: r._id.toString() })), pageInfo: { hasNextPage: false, hasPreviousPage: false } }
          }
          const { filter, sort, limit } = applyCursorToQuery({ productionCompany: company._id }, {
            after: args.after, first: args.first, sortField: 'startDate', sortDirection: -1, maxLimit: 200
          })
          const runs = await RunModel.find(filter).sort(sort).limit(limit).lean()
          return buildConnection(runs, { first: args.first, sortField: 'startDate', maxLimit: 200 })
        }
      },
      venues: {
        type: new GraphQLList(venueType),
        description: 'Unique venues from all runs',
        resolve: async (company: any, _args: any, ctx: any) => {
          const runs = ctx.loaders
            ? await ctx.loaders.runsByCompanyLoader.load(company._id.toString())
            : await RunModel.find({ productionCompany: company._id })
          const venueIds = [...new Set<string>(runs.flatMap((r: any) => r.venues.map((v: any) => v.toString())))]
          if (ctx.loaders) return Promise.all(venueIds.map(id => ctx.loaders.venueLoader.load(id)))
          return VenueModel.find({ _id: { $in: venueIds } })
        }
      },
      people: {
        type: new GraphQLList(personType),
        description: 'Unique people from all credits on runs',
        resolve: async (company: any, _args: any, ctx: any) => {
          const runs = ctx.loaders
            ? await ctx.loaders.runsByCompanyLoader.load(company._id.toString())
            : await RunModel.find({ productionCompany: company._id })
          const runIds = runs.map((r: any) => r._id)
          const credits = ctx.loaders
            ? (await Promise.all(runIds.map((id: any) => ctx.loaders.creditsByRunLoader.load(id.toString())))).flat()
            : await CreditModel.find({ run: { $in: runIds } })
          const personIds = [...new Set<string>(credits.map((c: any) => c.person.toString()))]
          if (ctx.loaders) return Promise.all(personIds.map(id => ctx.loaders.personLoader.load(id)))
          return PersonModel.find({ _id: { $in: personIds } })
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
