import {
  GraphQLBoolean,
  GraphQLNonNull,
  GraphQLString
} from 'graphql'
import { mutationWithClientMutationId } from 'graphql-relay'
import { ListModel } from '../listModel'
import { listType } from '../listTypes'
import { errorField } from '../../../graphql/errorField'
import { generateListSlug } from '../slugify'

export const listCreate = mutationWithClientMutationId({
  name: 'listCreate',
  description: 'Create a new list',
  inputFields: {
    name: {
      type: new GraphQLNonNull(GraphQLString),
      description: 'List name'
    },
    description: {
      type: GraphQLString,
      description: 'List description'
    },
    listType: {
      type: new GraphQLNonNull(GraphQLString),
      description: 'Entity type: shows, venues, runs, performances, or people'
    },
    isPublic: {
      type: GraphQLBoolean,
      description: 'Whether the list is public (default true)'
    }
  },
  outputFields: {
    list: {
      type: listType,
      resolve: response => response.list
    },
    ...errorField
  },
  mutateAndGetPayload: async ({ name, description, listType, isPublic }, ctx) => {
    if (!ctx.user) {
      return { list: null, error: 'Unauthorized' }
    }

    const validTypes = ['shows', 'venues', 'runs', 'performances', 'people']
    if (!validTypes.includes(listType)) {
      return { list: null, error: `Invalid list type. Must be one of: ${validTypes.join(', ')}` }
    }

    const slug = await generateListSlug(name, ctx.user.id)

    const list = await ListModel.create({
      name,
      slug,
      description: description || '',
      listType,
      isPublic: isPublic !== false,
      owner: ctx.user.id
    })

    return { list }
  }
})
