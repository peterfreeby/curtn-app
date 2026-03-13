import {
  GraphQLInt,
  GraphQLNonNull,
  GraphQLString
} from 'graphql'
import { mutationWithClientMutationId } from 'graphql-relay'
import { showCompanyCreditType } from '../showCompanyCreditTypes'
import { ShowCompanyCreditModel } from '../showCompanyCreditModel'
import { ProductionCompanyModel } from '../../productionCompany/productionCompanyModel'
import { errorField } from '../../../graphql/errorField'

export const showCompanyCreditCreate = mutationWithClientMutationId({
  name: 'showCompanyCreditCreate',
  description: 'Create a credit linking a production company to a show (e.g. Rights Holder, Original Producer, Licensor)',
  inputFields: {
    showId: {
      type: new GraphQLNonNull(GraphQLString),
      description: 'Show MongoDB ObjectId'
    },
    companyName: {
      type: new GraphQLNonNull(GraphQLString),
      description: 'Production company name (find-or-create by slug)'
    },
    role: {
      type: new GraphQLNonNull(GraphQLString),
      description: 'Role (e.g. "Rights Holder", "Original Producer", "Licensor", "Publisher")'
    },
    order: {
      type: GraphQLInt,
      description: 'Display order (default 0)'
    }
  },
  outputFields: {
    showCompanyCredit: {
      type: showCompanyCreditType,
      resolve: response => response.showCompanyCredit
    },
    ...errorField
  },
  mutateAndGetPayload: async (input, ctx) => {
    if (!ctx.user) {
      return { error: 'Unauthorized', showCompanyCredit: null }
    }

    const slug = input.companyName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')

    let company = await ProductionCompanyModel.findOne({ slug })
    if (!company) {
      company = await new ProductionCompanyModel({
        name: input.companyName,
        slug,
        submittedBy: ctx.user.id
      }).save()
    }

    try {
      const showCompanyCredit = await new ShowCompanyCreditModel({
        productionCompany: company._id,
        show: input.showId,
        role: input.role,
        order: input.order || 0,
        submittedBy: ctx.user.id
      }).save()

      return { showCompanyCredit }
    } catch {
      return { error: 'Failed to create show company credit (may already exist)' }
    }
  }
})
