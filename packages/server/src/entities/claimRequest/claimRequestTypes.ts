import {
  GraphQLString,
  GraphQLNonNull,
  GraphQLObjectType
} from 'graphql'
import { nodeInterface } from '../../graphql/nodeInterface'
import { globalIdField, connectionDefinitions } from 'graphql-relay'
import { entityRegister } from '../../graphql/entityHelpers'
import { ClaimRequestModel } from './claimRequestModel'

export const claimRequestType = new GraphQLObjectType({
  name: 'ClaimRequest',
  description: 'A request from a user to claim a Person profile, pending admin approval',
  interfaces: () => [nodeInterface],
  fields: () => {
    const { userType } = require('../user/userTypes')
    const { personType } = require('../person/personTypes')
    const { UserModel } = require('../user/userModel')
    const { PersonModel } = require('../person/personModel')

    return {
      id: globalIdField('ClaimRequest', cr => cr.id),
      user: {
        type: new GraphQLNonNull(userType),
        resolve: async (cr: any) => UserModel.findById(cr.user)
      },
      person: {
        type: new GraphQLNonNull(personType),
        resolve: async (cr: any) => PersonModel.findById(cr.person)
      },
      status: {
        type: new GraphQLNonNull(GraphQLString),
        resolve: (cr: any) => cr.status
      },
      message: {
        type: GraphQLString,
        resolve: (cr: any) => cr.message
      },
      requestedAt: {
        type: new GraphQLNonNull(GraphQLString),
        resolve: (cr: any) => cr.requestedAt?.toISOString()
      },
      reviewedAt: {
        type: GraphQLString,
        resolve: (cr: any) => cr.reviewedAt?.toISOString()
      },
      reviewedBy: {
        type: userType,
        resolve: async (cr: any) => {
          if (!cr.reviewedBy) return null
          return UserModel.findById(cr.reviewedBy)
        }
      },
      createdAt: {
        type: GraphQLString,
        resolve: (cr: any) => cr.createdAt?.toISOString()
      }
    }
  }
})

export const { connectionType: ClaimRequestConnection, edgeType: ClaimRequestEdge } = connectionDefinitions({
  nodeType: claimRequestType
})

entityRegister({
  type: claimRequestType,
  nodeResolver: async (id) => await ClaimRequestModel.findById(id)
})
