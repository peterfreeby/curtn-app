import {
  GraphQLBoolean,
  GraphQLID,
  GraphQLList,
  GraphQLNonNull,
  GraphQLString
} from 'graphql'
import { fromGlobalId, mutationWithClientMutationId } from 'graphql-relay'
import { ListModel, LIST_DATE_WINDOWS } from '../listModel'
import { listType } from '../listTypes'
import { errorField } from '../../../graphql/errorField'
import { generateListSlug } from '../slugify'

export const listUpdate = mutationWithClientMutationId({
  name: 'listUpdate',
  description: 'Update list metadata (owner only)',
  inputFields: {
    listId: {
      type: new GraphQLNonNull(GraphQLID),
      description: 'Global ID of the list'
    },
    name: {
      type: GraphQLString
    },
    description: {
      type: GraphQLString
    },
    isPublic: {
      type: GraphQLBoolean
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
  mutateAndGetPayload: async ({ listId, name, description, isPublic, sourceListIds, dateWindow }, ctx) => {
    if (!ctx.user) {
      return { list: null, error: 'Unauthorized' }
    }

    const { id } = fromGlobalId(listId)
    const list = await ListModel.findById(id)

    if (!list) {
      return { list: null, error: 'List not found' }
    }

    if (String(list.owner) !== ctx.user.id) {
      return { list: null, error: 'Only the list owner can update it' }
    }

    if (name !== undefined && name !== null) {
      list.name = name
      list.slug = await generateListSlug(name, ctx.user.id)
    }
    if (description !== undefined && description !== null) {
      list.description = description
    }
    if (isPublic !== undefined && isPublic !== null) {
      list.isPublic = isPublic
    }

    if (dateWindow !== undefined && dateWindow !== null) {
      if (!LIST_DATE_WINDOWS.includes(dateWindow)) {
        return { list: null, error: `Invalid dateWindow. Must be one of: ${LIST_DATE_WINDOWS.join(', ')}` }
      }
      list.dateWindow = dateWindow
    }

    if (sourceListIds !== undefined && sourceListIds !== null) {
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
      list.sourceListIds = ids as any
    }

    await list.save()
    return { list }
  }
})
