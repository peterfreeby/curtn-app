import {
  GraphQLString,
  GraphQLNonNull,
  GraphQLObjectType,
  GraphQLInt
} from 'graphql'
import { ProductionCompanyModel } from '../productionCompany/productionCompanyModel'
import { ShowModel } from '../show/showModel'
import { globalIdField, connectionDefinitions } from 'graphql-relay'
import { nodeInterface } from '../../graphql/nodeInterface'
import { entityRegister } from '../../graphql/entityHelpers'
import { ShowCompanyCreditModel } from './showCompanyCreditModel'

export const showCompanyCreditType: GraphQLObjectType = new GraphQLObjectType({
  name: 'ShowCompanyCredit',
  description: 'A credit linking a production company to a show (e.g. rights holder, original producer, licensor)',
  interfaces: () => [nodeInterface],
  fields: () => {
    const { productionCompanyType } = require('../productionCompany/productionCompanyTypes')
    const { showType } = require('../show/showTypes')
    return {
      id: globalIdField('ShowCompanyCredit', showCompanyCredit => showCompanyCredit._id),
      productionCompany: {
        type: new GraphQLNonNull(productionCompanyType),
        resolve: async (showCompanyCredit: any, _args: any, ctx: any) => {
          if (ctx.loaders) return ctx.loaders.productionCompanyLoader.load(showCompanyCredit.productionCompany.toString())
          return ProductionCompanyModel.findById(showCompanyCredit.productionCompany)
        }
      },
      show: {
        type: new GraphQLNonNull(showType),
        resolve: async (showCompanyCredit: any, _args: any, ctx: any) => {
          if (ctx.loaders) return ctx.loaders.showLoader.load(showCompanyCredit.show.toString())
          return ShowModel.findById(showCompanyCredit.show)
        }
      },
      role: {
        type: new GraphQLNonNull(GraphQLString),
        resolve: showCompanyCredit => showCompanyCredit.role
      },
      order: {
        type: GraphQLInt,
        resolve: showCompanyCredit => showCompanyCredit.order
      },
      createdAt: {
        type: GraphQLString,
        resolve: showCompanyCredit => showCompanyCredit.createdAt?.toISOString()
      },
      updatedAt: {
        type: GraphQLString,
        resolve: showCompanyCredit => showCompanyCredit.updatedAt?.toISOString()
      }
    }
  }
})

export const { connectionType: ShowCompanyCreditConnection, edgeType: ShowCompanyCreditEdge } = connectionDefinitions({
  nodeType: showCompanyCreditType
})

entityRegister({
  type: showCompanyCreditType,
  nodeResolver: async (id) => await ShowCompanyCreditModel.findById(id)
})
