import {
  GraphQLBoolean,
  GraphQLList,
  GraphQLString,
  GraphQLNonNull,
  GraphQLObjectType,
  ThunkObjMap,
  GraphQLInputFieldConfig
} from 'graphql'
import { nodeInterface } from '../../graphql/nodeInterface'
import { globalIdField, connectionDefinitions } from 'graphql-relay'
import { entityRegister } from '../../graphql/entityHelpers'
import { claimableFieldsGraphQL } from '../../permissions/claimableFieldsGraphQL'
import { PersonModel } from './personModel'
import { CreditModel } from '../credit/creditModel'
import { ShowCreditModel } from '../showCredit/showCreditModel'
import { RunModel } from '../run/runModel'
import { ProductionCompanyModel } from '../productionCompany/productionCompanyModel'

export const personType: GraphQLObjectType = new GraphQLObjectType({
  name: 'Person',
  description: 'A cast or crew member',
  interfaces: () => [nodeInterface],
  fields: () => {
    const { creditType } = require('../credit/creditType')
    const { showCreditType } = require('../showCredit/showCreditTypes')
    const { productionCompanyType } = require('../productionCompany/productionCompanyTypes')
    const { userType } = require('../user/userTypes')
    return {
      id: globalIdField('Person', person => person.id),
      name: {
        type: new GraphQLNonNull(GraphQLString),
        resolve: person => person.name
      },
      slug: {
        type: new GraphQLNonNull(GraphQLString),
        resolve: person => person.slug
      },
      bio: {
        type: GraphQLString,
        resolve: person => person.bio
      },
      headshotUrl: {
        type: GraphQLString,
        resolve: person => person.headshotUrl
      },
      wikidataId: {
        type: GraphQLString,
        resolve: person => person.wikidataId
      },
      castCredits: {
        type: new GraphQLList(creditType),
        resolve: async (person: any, _args: any, ctx: any) => {
          if (ctx.loaders) {
            const credits = await ctx.loaders.creditsByPersonLoader.load(person._id.toString())
            return credits.filter((c: any) => c.creditType === 'cast')
          }
          return CreditModel.find({ person: person._id, creditType: 'cast' }).sort({ order: 1 }).limit(200).lean()
        }
      },
      crewCredits: {
        type: new GraphQLList(creditType),
        resolve: async (person: any, _args: any, ctx: any) => {
          if (ctx.loaders) {
            const credits = await ctx.loaders.creditsByPersonLoader.load(person._id.toString())
            return credits.filter((c: any) => c.creditType === 'crew')
          }
          return CreditModel.find({ person: person._id, creditType: 'crew' }).sort({ order: 1 }).limit(200).lean()
        }
      },
      showCredits: {
        type: new GraphQLList(showCreditType),
        description: 'Show-level credits (e.g. playwright, composer, lyricist)',
        resolve: async (person: any, _args: any, ctx: any) => {
          if (ctx.loaders) return ctx.loaders.showCreditsByPersonLoader.load(person._id.toString())
          return ShowCreditModel.find({ person: person._id }).sort({ order: 1 })
        }
      },
      productionCompanies: {
        type: new GraphQLList(productionCompanyType),
        description: 'Unique companies this person has worked with',
        resolve: async (person: any, _args: any, ctx: any) => {
          const credits = ctx.loaders
            ? await ctx.loaders.creditsByPersonLoader.load(person._id.toString())
            : await CreditModel.find({ person: person._id })
          const runIds = [...new Set<string>(credits.map((c: any) => c.run.toString()))]
          const runs = ctx.loaders
            ? await Promise.all(runIds.map(id => ctx.loaders.runLoader.load(id)))
            : await RunModel.find({ _id: { $in: runIds } })
          const companyIds = [...new Set<string>(runs.filter((r: any) => r?.productionCompany).map((r: any) => r.productionCompany.toString()))]
          if (ctx.loaders) return Promise.all(companyIds.map(id => ctx.loaders.productionCompanyLoader.load(id)))
          return ProductionCompanyModel.find({ _id: { $in: companyIds } })
        }
      },
      user: {
        type: userType,
        description: 'Linked User account (if this person has claimed a profile)',
        resolve: async (person: any, _args: any, ctx: any) => {
          if (!person.userId) return null
          if (ctx.loaders) return ctx.loaders.userLoader.load(person.userId.toString())
          const { UserModel } = require('../user/userModel')
          return UserModel.findById(person.userId)
        }
      },
      isClaimed: {
        type: GraphQLBoolean,
        description: 'Whether this person has been claimed by a user',
        resolve: (person: any) => !!person.userId
      },
      createdAt: {
        type: GraphQLString,
        resolve: person => person.createdAt?.toISOString()
      },
      updatedAt: {
        type: GraphQLString,
        resolve: person => person.updatedAt?.toISOString()
      },
      ...claimableFieldsGraphQL()
    }
  }
})

export const personInputType: ThunkObjMap<GraphQLInputFieldConfig> = {
  name: {
    type: new GraphQLNonNull(GraphQLString),
    description: `Person's name`
  }
}

export const { connectionType: PersonConnection, edgeType: PersonEdge } = connectionDefinitions({
  nodeType: personType
})

entityRegister({
  type: personType,
  nodeResolver: async (id) => await PersonModel.findById(id)
})
