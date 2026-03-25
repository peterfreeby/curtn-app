import {
  GraphQLBoolean,
  GraphQLInt,
  GraphQLString,
  GraphQLNonNull,
  GraphQLObjectType,
  GraphQLInputFieldConfig,
  ThunkObjMap
} from 'graphql'
import { connectionDefinitions, globalIdField } from 'graphql-relay'
import { nodeInterface } from '../../graphql/nodeInterface'
import { entityRegister } from '../../graphql/entityHelpers'
import { UserModel } from './userModel'
import { FollowModel } from '../follow/followModel'
import { ReviewModel } from '../review/reviewModel'

export const userType = new GraphQLObjectType({
  name: 'User',
  description: 'User type',
  interfaces: () => [nodeInterface],
  fields: () => ({
    id: globalIdField('User', user => user._id),
    fullName: {
      type: new GraphQLNonNull(GraphQLString),
      description: `User's full name`,
      resolve: user => user.fullName
    },
    username: {
      type: new GraphQLNonNull(GraphQLString),
      description: `User's username`,
      resolve: user => user.username
    },
    email: {
      type: new GraphQLNonNull(GraphQLString),
      description: `User's email`,
      resolve: user => user.email
    },
    bio: {
      type: GraphQLString,
      description: `User's bio`,
      resolve: user => user.bio || ''
    },
    avatarUrl: {
      type: GraphQLString,
      description: `User's avatar image URL`,
      resolve: user => user.avatarUrl || ''
    },
    followerCount: {
      type: GraphQLInt,
      description: 'Number of followers',
      resolve: async user => FollowModel.countDocuments({ following: user._id })
    },
    followingCount: {
      type: GraphQLInt,
      description: 'Number of users this user follows',
      resolve: async user => FollowModel.countDocuments({ follower: user._id })
    },
    isFollowing: {
      type: GraphQLBoolean,
      description: 'Whether the current viewer follows this user',
      resolve: async (user, _args, ctx: any) => {
        if (!ctx.user || ctx.user.id === String(user._id)) return false
        const doc = await FollowModel.findOne({ follower: ctx.user.id, following: user._id })
        return !!doc
      }
    },
    isAdmin: {
      type: GraphQLBoolean,
      resolve: user => !!user.isAdmin
    },
    reviewCount: {
      type: GraphQLInt,
      description: 'Number of reviews this user has written',
      resolve: async user => ReviewModel.countDocuments({ user: user._id })
    },
    listCount: {
      type: GraphQLInt,
      description: 'Number of public lists this user has created',
      resolve: async user => {
        const { ListModel } = require('../list/listModel')
        return ListModel.countDocuments({ owner: user._id, isPublic: true })
      }
    },
    lists: {
      type: require('../list/listTypes').ListConnection,
      description: "User's public lists",
      resolve: async (user: any, _args: any, ctx: any) => {
        const { ListModel } = require('../list/listModel')
        const filter: any = { owner: user._id }
        if (!ctx.user || ctx.user.id !== String(user._id)) {
          filter.isPublic = true
        }
        const lists = await ListModel.find(filter).sort({ createdAt: -1 })
        return {
          edges: lists.map((l: any) => ({ node: l, cursor: l._id.toString() })),
          pageInfo: { hasNextPage: false, hasPreviousPage: false }
        }
      }
    }
  })
})

export const userInputType: ThunkObjMap<GraphQLInputFieldConfig> = {
  fullName: {
    type: new GraphQLNonNull(GraphQLString),
    description: `User's full name`
  },
  email: {
    type: new GraphQLNonNull(GraphQLString),
    description: `User's email`
  },
  username: {
    type: new GraphQLNonNull(GraphQLString),
    description: `User's username`
  },
  password: {
    type: new GraphQLNonNull(GraphQLString),
    description: `User's password`
  },
  confirmPassword: {
    type: new GraphQLNonNull(GraphQLString),
    description: `User's confirm password`
  }
}

export const { connectionType: UserConnection, edgeType: UserEdge } = connectionDefinitions({
  nodeType: userType
})

entityRegister({
  type: userType,
  nodeResolver: async (id) => await UserModel.findById(id)
})
