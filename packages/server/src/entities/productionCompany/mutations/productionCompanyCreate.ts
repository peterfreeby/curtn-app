import { GraphQLNonNull, GraphQLString } from 'graphql'
import { mutationWithClientMutationId } from 'graphql-relay'
import { productionCompanyType } from '../productionCompanyTypes'
import { ProductionCompanyModel } from '../productionCompanyModel'
import { errorField } from '../../../graphql/errorField'

export const productionCompanyCreate = mutationWithClientMutationId({
  name: 'productionCompanyCreate',
  description: 'Create a new production company',
  inputFields: {
    name: {
      type: new GraphQLNonNull(GraphQLString),
      description: 'Company name'
    },
    description: {
      type: GraphQLString,
      description: 'Company description'
    },
    logoUrl: {
      type: GraphQLString,
      description: 'Logo URL'
    }
  },
  outputFields: {
    productionCompany: {
      type: productionCompanyType,
      resolve: response => response.productionCompany
    },
    ...errorField
  },
  mutateAndGetPayload: async (input, ctx) => {
    if (!ctx.user) {
      return { error: 'Unauthorized', productionCompany: null }
    }

    const slug = input.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')

    try {
      const company = await new ProductionCompanyModel({
        name: input.name,
        slug,
        description: input.description,
        logoUrl: input.logoUrl,
        submittedBy: ctx.user.id
      }).save()

      return { productionCompany: company }
    } catch {
      return { error: 'Failed to create production company (name may already exist)' }
    }
  }
})
