import { GraphQLNonNull, GraphQLObjectType, GraphQLString } from 'graphql'
import { connectionDefinitions, globalIdField } from 'graphql-relay'
import { nodeInterface } from '../../graphql/nodeInterface'
import { entityRegister } from '../../graphql/entityHelpers'
import { ClaimTransferModel } from './claimTransferModel'

const claimTransferTargetType = new GraphQLObjectType({
  name: 'ClaimTransferTarget',
  fields: () => ({
    kind: { type: new GraphQLNonNull(GraphQLString), resolve: (t: any) => t.kind },
    targetId: { type: new GraphQLNonNull(GraphQLString), resolve: (t: any) => t.id?.toString() },
    name: {
      type: GraphQLString,
      resolve: async (t: any) => {
        if (!t.kind || !t.id) return null
        if (t.kind === 'venue') {
          const { VenueModel } = require('../venue/venueModel')
          return (await VenueModel.findById(t.id).select('name').lean())?.name ?? null
        }
        if (t.kind === 'productionCompany') {
          const { ProductionCompanyModel } = require('../productionCompany/productionCompanyModel')
          return (await ProductionCompanyModel.findById(t.id).select('name').lean())?.name ?? null
        }
        if (t.kind === 'person') {
          const { PersonModel } = require('../person/personModel')
          return (await PersonModel.findById(t.id).select('name').lean())?.name ?? null
        }
        return null
      }
    },
    slug: {
      type: GraphQLString,
      resolve: async (t: any) => {
        if (!t.kind || !t.id) return null
        if (t.kind === 'venue') {
          const { VenueModel } = require('../venue/venueModel')
          return (await VenueModel.findById(t.id).select('slug').lean())?.slug ?? null
        }
        if (t.kind === 'productionCompany') {
          const { ProductionCompanyModel } = require('../productionCompany/productionCompanyModel')
          return (await ProductionCompanyModel.findById(t.id).select('slug').lean())?.slug ?? null
        }
        if (t.kind === 'person') {
          const { PersonModel } = require('../person/personModel')
          return (await PersonModel.findById(t.id).select('slug').lean())?.slug ?? null
        }
        return null
      }
    }
  })
})

export const claimTransferType: GraphQLObjectType = new GraphQLObjectType({
  name: 'ClaimTransfer',
  description: 'A pending or resolved transfer of a claim from one user to another.',
  interfaces: () => [nodeInterface],
  fields: () => {
    const { userType } = require('../user/userTypes')
    const { UserModel } = require('../user/userModel')
    return {
      id: globalIdField('ClaimTransfer', t => t.id),
      fromUser: {
        type: new GraphQLNonNull(userType),
        resolve: async (t: any) => UserModel.findById(t.fromUser),
      },
      toUser: {
        type: new GraphQLNonNull(userType),
        resolve: async (t: any) => UserModel.findById(t.toUser),
      },
      target: {
        type: new GraphQLNonNull(claimTransferTargetType),
        resolve: (t: any) => t.target,
      },
      status: { type: new GraphQLNonNull(GraphQLString), resolve: (t: any) => t.status },
      message: { type: GraphQLString, resolve: (t: any) => t.message ?? null },
      expiresAt: { type: new GraphQLNonNull(GraphQLString), resolve: (t: any) => t.expiresAt?.toISOString() },
      respondedAt: { type: GraphQLString, resolve: (t: any) => t.respondedAt?.toISOString() ?? null },
      createdAt: { type: GraphQLString, resolve: (t: any) => t.createdAt?.toISOString() },
    }
  }
})

export const { connectionType: ClaimTransferConnection } = connectionDefinitions({
  nodeType: claimTransferType
})

entityRegister({
  type: claimTransferType,
  nodeResolver: async (id) => await ClaimTransferModel.findById(id)
})
