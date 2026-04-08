import {
  GraphQLString,
  GraphQLNonNull,
  GraphQLObjectType,
  GraphQLInt
} from 'graphql'
import { PersonModel } from '../person/personModel'
import { RunModel } from '../run/runModel'
import { globalIdField } from 'graphql-relay'

export const creditType = new GraphQLObjectType({
  name: 'Credit',
  description: 'A cast or crew credit linking a person to a run',
  fields: () => {
    const { personType } = require('../person/personTypes')
    const { runType } = require('../run/runTypes')
    return {
      id: globalIdField('Credit', credit => credit._id),
      person: {
        type: new GraphQLNonNull(personType),
        resolve: async (credit: any, _args: any, ctx: any) => {
          if (ctx.loaders) return ctx.loaders.personLoader.load(credit.person.toString())
          return PersonModel.findById(credit.person)
        }
      },
      run: {
        type: new GraphQLNonNull(runType),
        resolve: async (credit: any, _args: any, ctx: any) => {
          if (ctx.loaders) return ctx.loaders.runLoader.load(credit.run.toString())
          return RunModel.findById(credit.run)
        }
      },
      creditType: {
        type: new GraphQLNonNull(GraphQLString),
        resolve: credit => credit.creditType
      },
      role: {
        type: new GraphQLNonNull(GraphQLString),
        resolve: credit => credit.role
      },
      order: {
        type: GraphQLInt,
        resolve: credit => credit.order
      },
      createdAt: {
        type: GraphQLString,
        resolve: credit => credit.createdAt?.toISOString()
      }
    }
  }
})
