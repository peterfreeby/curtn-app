import { GraphQLFieldConfig, GraphQLNonNull, GraphQLString } from 'graphql'
import { listType } from '../listTypes'
import { ListModel } from '../listModel'

export const listBySlug: GraphQLFieldConfig<any, any, { ownerUsername: string, slug: string }> = {
  type: listType,
  args: {
    ownerUsername: {
      type: new GraphQLNonNull(GraphQLString),
      description: 'Username of the list owner'
    },
    slug: {
      type: new GraphQLNonNull(GraphQLString),
      description: 'List slug'
    }
  },
  resolve: async (_, { ownerUsername, slug }, ctx) => {
    const { UserModel } = require('../../user/userModel')
    const owner = await UserModel.findOne({ username: ownerUsername })
    if (!owner) return null

    const list = await ListModel.findOne({ owner: owner._id, slug })
    if (!list) return null

    if (!list.isPublic) {
      if (!ctx.user) return null
      const isOwner = String(list.owner) === ctx.user.id
      const isCollaborator = list.collaborators?.some(c => String(c) === ctx.user.id)
      if (!isOwner && !isCollaborator && !ctx.user.isAdmin) return null
    }

    return list
  }
}
