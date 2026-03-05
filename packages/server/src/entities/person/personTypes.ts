import {
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
import { RunModel } from '../run/runModel'
import { ProductionCompanyModel } from '../productionCompany/productionCompanyModel'

export const personType: GraphQLObjectType = new GraphQLObjectType({
  name: 'Person',
  description: 'A cast or crew member',
  interfaces: () => [nodeInterface],
  fields: () => {
    const { creditType } = require('../credit/creditType')
    const { productionCompanyType } = require('../productionCompany/productionCompanyTypes')
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
      productionCompanies: {
        type: new GraphQLList(productionCompanyType),
        description: 'Unique companies this person has worked with',
        resolve: async person => {
          const credits = await CreditModel.find({ person: person._id })
          const runIds = [...new Set(credits.map(c => c.run.toString()))]
          const runs = await RunModel.find({ _id: { $in: runIds } })
          const companyIds = [...new Set(runs.map(r => r.productionCompany.toString()))]
          return await ProductionCompanyModel.find({ _id: { $in: companyIds } })
        }
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
