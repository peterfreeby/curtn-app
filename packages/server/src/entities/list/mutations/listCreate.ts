import {
  GraphQLBoolean,
  GraphQLID,
  GraphQLList,
  GraphQLNonNull,
  GraphQLString
} from 'graphql'
import { fromGlobalId, mutationWithClientMutationId } from 'graphql-relay'
import { ListModel, LIST_SOURCE_ENTITY_TYPES, LIST_SOURCE_MODES, LIST_DATE_WINDOWS } from '../listModel'
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
    },
    sourceListIds: {
      type: new GraphQLList(GraphQLID),
      description: 'For combined lists: global IDs of the show lists to union over'
    },
    dateWindow: {
      type: GraphQLString,
      description: `For combined lists: one of ${LIST_DATE_WINDOWS.join(', ')}`
    }
  },
  outputFields: {
    list: {
      type: listType,
      resolve: response => response.list
    },
    ...errorField
  },
  mutateAndGetPayload: async ({ name, description, listType, isPublic, sourceMode, sourceEntityType, sourceEntityId, followTargetType, sourceListIds, dateWindow }, ctx) => {
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

    if (mode === 'combined') {
      if (!dateWindow || !LIST_DATE_WINDOWS.includes(dateWindow)) {
        return { list: null, error: `Combined lists require a dateWindow: ${LIST_DATE_WINDOWS.join(', ')}` }
      }
      if (!Array.isArray(sourceListIds) || sourceListIds.length === 0) {
        return { list: null, error: 'Combined lists require at least one source list' }
      }
      const ids = sourceListIds.map((gid: string) => fromGlobalId(gid).id)
      const sources = await ListModel.find({ _id: { $in: ids } }).select('listType sourceMode').lean()
      if (sources.length !== ids.length) {
        return { list: null, error: 'One or more source lists were not found' }
      }
      const invalid = sources.find((s: any) => s.listType !== 'shows' || s.sourceMode === 'combined')
      if (invalid) {
        return { list: null, error: 'Source lists must be show lists and cannot themselves be combined lists' }
      }
      extra.sourceListIds = ids
      extra.dateWindow = dateWindow
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
