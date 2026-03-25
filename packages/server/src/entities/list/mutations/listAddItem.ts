import {
  GraphQLID,
  GraphQLNonNull,
  GraphQLString
} from 'graphql'
import { fromGlobalId, mutationWithClientMutationId } from 'graphql-relay'
import { ListModel } from '../listModel'
import { ListItemModel } from '../listItemModel'
import { listItemType, getModelForListType } from '../listTypes'
import { errorField } from '../../../graphql/errorField'

export const listAddItem = mutationWithClientMutationId({
  name: 'listAddItem',
  description: 'Add an item to a list (owner or collaborator)',
  inputFields: {
    listId: {
      type: new GraphQLNonNull(GraphQLID),
      description: 'Global ID of the list'
    },
    itemId: {
      type: new GraphQLNonNull(GraphQLID),
      description: 'Global ID of the entity to add'
    },
    note: {
      type: GraphQLString,
      description: 'Optional note about this item'
    }
  },
  outputFields: {
    listItem: {
      type: listItemType,
      resolve: response => response.listItem
    },
    ...errorField
  },
  mutateAndGetPayload: async ({ listId, itemId, note }, ctx) => {
    if (!ctx.user) {
      return { listItem: null, error: 'Unauthorized' }
    }

    const { id: listObjectId } = fromGlobalId(listId)
    const list = await ListModel.findById(listObjectId)

    if (!list) {
      return { listItem: null, error: 'List not found' }
    }

    const isOwner = String(list.owner) === ctx.user.id
    const isCollaborator = list.collaborators?.some(c => String(c) === ctx.user.id)
    if (!isOwner && !isCollaborator) {
      return { listItem: null, error: 'You do not have edit access to this list' }
    }

    const { id: targetItemId } = fromGlobalId(itemId)

    const Model = getModelForListType(list.listType)
    if (!Model) {
      return { listItem: null, error: 'Invalid list type' }
    }

    const entity = await Model.findById(targetItemId)
    if (!entity) {
      return { listItem: null, error: `${list.listType.slice(0, -1)} not found` }
    }

    const existing = await ListItemModel.findOne({ list: list._id, itemId: targetItemId })
    if (existing) {
      return { listItem: null, error: 'Item is already in this list' }
    }

    const maxPosition = await ListItemModel.findOne({ list: list._id }).sort({ position: -1 })
    const position = maxPosition ? maxPosition.position + 1 : 0

    const listItem = await ListItemModel.create({
      list: list._id,
      itemId: targetItemId,
      position,
      addedBy: ctx.user.id,
      note
    })

    await ListModel.findByIdAndUpdate(list._id, { $inc: { itemCount: 1 } })

    return { listItem }
  }
})
