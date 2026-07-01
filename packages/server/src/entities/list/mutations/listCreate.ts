import {
  GraphQLBoolean,
  GraphQLID,
  GraphQLNonNull,
  GraphQLString
} from 'graphql'
import { fromGlobalId, mutationWithClientMutationId } from 'graphql-relay'
import { ListModel, LIST_SOURCE_ENTITY_TYPES, LIST_SOURCE_MODES } from '../listModel'
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
    },
    sourceMode: {
      type: GraphQLString,
      description: 'How items are populated: manual (default), entity, or follows'
    },
    sourceEntityType: {
      type: GraphQLString,
      description: 'For entity lists: venue, person, or productionCompany'
    },
    sourceEntityId: {
      type: GraphQLID,
      description: 'For entity lists: global ID of the source entity'
    },
    followTargetType: {
      type: GraphQLString,
      description: 'For follows lists: venue, person, or productionCompany'
    }
  },
  outputFields: {
    list: {
      type: listType,
      resolve: response => response.list
    },
    ...errorField
  },
  mutateAndGetPayload: async ({ name, description, listType, isPublic, sourceMode, sourceEntityType, sourceEntityId, followTargetType }, ctx) => {
    if (!ctx.user) {
      return { list: null, error: 'Unauthorized' }
    }

    const validTypes = ['shows', 'venues', 'runs', 'performances', 'people']
    if (!validTypes.includes(listType)) {
      return { list: null, error: `Invalid list type. Must be one of: ${validTypes.join(', ')}` }
    }

    const mode = sourceMode || 'manual'
    if (!LIST_SOURCE_MODES.includes(mode)) {
      return { list: null, error: `Invalid source mode. Must be one of: ${LIST_SOURCE_MODES.join(', ')}` }
    }

    // Dynamic lists are always lists of shows.
    if (mode !== 'manual' && listType !== 'shows') {
      return { list: null, error: 'Dynamic lists (entity/follows) must have listType "shows"' }
    }

    const extra: any = { sourceMode: mode }

    if (mode === 'entity') {
      if (!sourceEntityType || !LIST_SOURCE_ENTITY_TYPES.includes(sourceEntityType)) {
        return { list: null, error: `Entity lists require sourceEntityType: ${LIST_SOURCE_ENTITY_TYPES.join(', ')}` }
      }
      if (!sourceEntityId) {
        return { list: null, error: 'Entity lists require a sourceEntityId' }
      }
      extra.sourceEntityType = sourceEntityType
      extra.sourceEntityId = fromGlobalId(sourceEntityId).id
    }

    if (mode === 'follows') {
      if (!followTargetType || !LIST_SOURCE_ENTITY_TYPES.includes(followTargetType)) {
        return { list: null, error: `Follows lists require followTargetType: ${LIST_SOURCE_ENTITY_TYPES.join(', ')}` }
      }
      extra.followTargetType = followTargetType
    }

    const slug = await generateListSlug(name, ctx.user.id)

    const list = await ListModel.create({
      name,
      slug,
      description: description || '',
      listType,
      isPublic: isPublic !== false,
      owner: ctx.user.id,
      ...extra
    })

    return { list }
  }
})
