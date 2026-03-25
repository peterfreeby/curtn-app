import {
  GraphQLID,
  GraphQLNonNull
} from 'graphql'
import { fromGlobalId, mutationWithClientMutationId } from 'graphql-relay'
import { ListModel } from '../listModel'
import { listType } from '../listTypes'
import { errorField } from '../../../graphql/errorField'

export const listAddCollaborator = mutationWithClientMutationId({
  name: 'listAddCollaborator',
  description: 'Invite a user as a collaborator (owner only)',
  inputFields: {
    listId: {
      type: new GraphQLNonNull(GraphQLID),
      description: 'Global ID of the list'
    },
    userId: {
      type: new GraphQLNonNull(GraphQLID),
      description: 'Global ID of the user to invite'
    }
  },
  outputFields: {
    list: {
      type: listType,
      resolve: response => response.list
    },
    ...errorField
  },
  mutateAndGetPayload: async ({ listId, userId }, ctx) => {
    if (!ctx.user) {
      return { list: null, error: 'Unauthorized' }
    }

    const { id: listObjectId } = fromGlobalId(listId)
    const list = await ListModel.findById(listObjectId)

    if (!list) {
      return { list: null, error: 'List not found' }
    }

    if (String(list.owner) !== ctx.user.id) {
      return { list: null, error: 'Only the list owner can add collaborators' }
    }

    const { id: targetUserId } = fromGlobalId(userId)

    const { UserModel } = require('../../user/userModel')
    const targetUser = await UserModel.findById(targetUserId)
    if (!targetUser) {
      return { list: null, error: 'User not found' }
    }

    if (String(list.owner) === targetUserId) {
      return { list: null, error: 'Cannot add the owner as a collaborator' }
    }

    if (list.collaborators?.some(c => String(c) === targetUserId)) {
      return { list: null, error: 'User is already a collaborator' }
    }

    await ListModel.findByIdAndUpdate(list._id, {
      $addToSet: { collaborators: targetUserId }
    })

    return { list: await ListModel.findById(list._id) }
  }
})
