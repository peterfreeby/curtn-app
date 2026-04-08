import {
  GraphQLBoolean,
  GraphQLInt,
  GraphQLString,
  GraphQLNonNull,
  GraphQLObjectType,
  GraphQLInputFieldConfig,
  ThunkObjMap
} from 'graphql'
import { connectionDefinitions, globalIdField, connectionArgs } from 'graphql-relay'
import { applyCursorToQuery, buildConnection } from '../../graphql/cursorPagination'
import { nodeInterface } from '../../graphql/nodeInterface'
import { entityRegister } from '../../graphql/entityHelpers'
import { UserModel } from './userModel'
import { FollowModel } from '../follow/followModel'
import { ReviewModel } from '../review/reviewModel'
// PersonModel imported lazily in fields() to avoid circular deps

export const userType = new GraphQLObjectType({
  name: 'User',
  description: 'User type',
  interfaces: () => [nodeInterface],
  fields: () => ({
    id: globalIdField('User', user => user._id),
    fullName: {
      type: GraphQLString,
      description: `User's full name`,
      resolve: user => user.fullName
    },
    username: {
      type: GraphQLString,
      description: `User's username`,
      resolve: user => user.username
    },
    email: {
      type: GraphQLString,
      description: `User's email`,
      resolve: user => user.email
    },
    phoneNumber: {
      type: GraphQLString,
      description: `User's phone number`,
      resolve: user => user.phoneNumber
    },
    hasProfile: {
      type: new GraphQLNonNull(GraphQLBoolean),
      description: 'Whether the user has completed onboarding',
      resolve: user => !!user.username && !!user.fullName
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
      resolve: async (user: any, _args: any, ctx: any) => {
        if (ctx.loaders) return ctx.loaders.followerCountLoader.load(user._id.toString())
        return FollowModel.countDocuments({ following: user._id })
      }
    },
    followingCount: {
      type: GraphQLInt,
      description: 'Number of users this user follows',
      resolve: async (user: any, _args: any, ctx: any) => {
        if (ctx.loaders) return ctx.loaders.followingCountLoader.load(user._id.toString())
        return FollowModel.countDocuments({ follower: user._id })
      }
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
      resolve: async (user: any, _args: any, ctx: any) => {
        if (ctx.loaders) return ctx.loaders.reviewCountByUserLoader.load(user._id.toString())
        return ReviewModel.countDocuments({ user: user._id })
      }
    },
    person: {
      type: require('../person/personTypes').personType,
      description: 'Linked Person entity (for cast/crew credits)',
      resolve: async (user: any, _args: any, ctx: any) => {
        if (!user.personId) return null
        if (ctx.loaders) return ctx.loaders.personLoader.load(user.personId.toString())
        const { PersonModel } = require('../person/personModel')
        return PersonModel.findById(user.personId)
      }
    },
    listCount: {
      type: GraphQLInt,
      description: 'Number of public lists this user has created',
      resolve: async (user: any, _args: any, ctx: any) => {
        if (ctx.loaders) return ctx.loaders.listCountByUserLoader.load(user._id.toString())
        const { ListModel } = require('../list/listModel')
        return ListModel.countDocuments({ owner: user._id, isPublic: true })
      }
    },
    lists: {
      type: require('../list/listTypes').ListConnection,
      description: "User's public lists",
      args: { ...connectionArgs },
      resolve: async (user: any, args: any, ctx: any) => {
        const { ListModel } = require('../list/listModel')
        const baseFilter: any = { owner: user._id }
        if (!ctx.user || ctx.user.id !== String(user._id)) {
          baseFilter.isPublic = true
        }
        const { filter, sort, limit } = applyCursorToQuery(baseFilter, {
          after: args.after, first: args.first, sortField: 'createdAt', sortDirection: -1, maxLimit: 100
        })
        const lists = await ListModel.find(filter).sort(sort).limit(limit).lean()
        return buildConnection(lists, { first: args.first, sortField: 'createdAt', maxLimit: 100 })
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
