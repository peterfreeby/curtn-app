import { GraphQLNonNull, GraphQLString, GraphQLList, GraphQLInt, GraphQLBoolean } from 'graphql'
import { mutationWithClientMutationId } from 'graphql-relay'
import { showType } from '../showTypes'
import { ShowModel } from '../showModel'
import { ReviewModel } from '../../review/reviewModel'
import { errorField } from '../../../graphql/errorField'

function escapeRegex(str: string) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export const showFindOrCreate = mutationWithClientMutationId({
  name: 'showFindOrCreate',
  description: 'Find an existing show by title or create a new one',
  inputFields: {
    title: {
      type: new GraphQLNonNull(GraphQLString),
      description: 'Show title (case-insensitive match)'
    },
    description: {
      type: GraphQLString,
      description: 'Show description'
    },
    performanceTypes: {
      type: new GraphQLList(GraphQLString),
      description: 'Types of performance'
    },
    duration: {
      type: GraphQLInt,
      description: 'Duration in minutes'
    },
    languages: {
      type: new GraphQLList(GraphQLString),
      description: 'Languages'
    },
    url: {
      type: GraphQLString,
      description: 'External URL for the show (website, social media, etc.)'
    }
  },
  outputFields: {
    show: {
      type: showType,
      resolve: response => response.show
    },
    created: {
      type: GraphQLBoolean,
      resolve: response => response.created
    },
    ...errorField
  },
  mutateAndGetPayload: async (input, ctx) => {
    if (!ctx.user) {
      return { error: 'Unauthorized', show: null, created: false }
    }

    try {
      const escaped = escapeRegex(input.title.trim())
      const existing = await ShowModel.findOne({
        title: { $regex: new RegExp(`^${escaped}$`, 'i') }
      })

      if (existing) {
        return { show: existing, created: false }
      }

      const show = await new ShowModel({
        title: input.title.trim(),
        description: input.description || '',
        performanceTypes: input.performanceTypes || [],
        duration: input.duration || 0,
        languages: input.languages || [],
        url: input.url,
        verificationStatus: 'community',
        submittedBy: ctx.user.id
      }).save()

      return { show, created: true }
    } catch (err) {
      console.error('showFindOrCreate error:', err)
      return { error: 'Failed to find or create show' }
    }
  }
})
