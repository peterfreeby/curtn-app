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
        resolve: async person => await CreditModel.find({ person: person._id, creditType: 'cast' }).sort({ order: 1 })
      },
      crewCredits: {
        type: new GraphQLList(creditType),
        resolve: async person => await CreditModel.find({ person: person._id, creditType: 'crew' }).sort({ order: 1 })
      },
      showCredits: {
        type: new GraphQLList(showCreditType),
        description: 'Show-level credits (e.g. playwright, composer, lyricist)',
        resolve: async person => await ShowCreditModel.find({ person: person._id }).sort({ order: 1 })
      },
      productionCompanies: {
        type: new GraphQLList(productionCompanyType),
        description: 'Unique companies this person has worked with',
        resolve: async person => {
          const credits = await CreditModel.find({ person: person._id })
          const runIds = [...new Set(credits.map(c => c.run.toString()))]
          const runs = await RunModel.find({ _id: { $in: runIds } })
          const companyIds = [...new Set(runs.filter(r => r.productionCompany).map(r => r.productionCompany!.toString()))]
          return await ProductionCompanyModel.find({ _id: { $in: companyIds } })
        }
      },
      user: {
        type: userType,
        description: 'Linked User account (if this person has claimed a profile)',
        resolve: async (person: any) => {
          if (!person.userId) return null
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
      }
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
