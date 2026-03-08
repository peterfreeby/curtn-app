import {
  GraphQLString,
  GraphQLNonNull,
  GraphQLObjectType,
  GraphQLInt
} from 'graphql'
import { PersonModel } from '../person/personModel'
import { ShowModel } from '../show/showModel'
import { globalIdField, connectionDefinitions } from 'graphql-relay'
import { nodeInterface } from '../../graphql/nodeInterface'
import { entityRegister } from '../../graphql/entityHelpers'
import { ShowCreditModel } from './showCreditModel'

export const showCreditType: GraphQLObjectType = new GraphQLObjectType({
  name: 'ShowCredit',
  description: 'A credit linking a person to a show (e.g. playwright, composer, lyricist)',
  interfaces: () => [nodeInterface],
  fields: () => {
    const { personType } = require('../person/personTypes')
    const { showType } = require('../show/showTypes')
    return {
      id: globalIdField('ShowCredit', showCredit => showCredit._id),
      person: {
        type: new GraphQLNonNull(personType),
        resolve: async showCredit => await PersonModel.findById(showCredit.person)
      },
      show: {
        type: new GraphQLNonNull(showType),
        resolve: async showCredit => await ShowModel.findById(showCredit.show)
      },
      role: {
        type: new GraphQLNonNull(GraphQLString),
        resolve: showCredit => showCredit.role
      },
      order: {
        type: GraphQLInt,
        resolve: showCredit => showCredit.order
      },
      createdAt: {
        type: GraphQLString,
        resolve: showCredit => showCredit.createdAt?.toISOString()
      },
      updatedAt: {
        type: GraphQLString,
        resolve: showCredit => showCredit.updatedAt?.toISOString()
      }
    }
  }
})

export const { connectionType: ShowCreditConnection, edgeType: ShowCreditEdge } = connectionDefinitions({
  nodeType: showCreditType
})

entityRegister({
  type: showCreditType,
  nodeResolver: async (id) => await ShowCreditModel.findById(id)
})
