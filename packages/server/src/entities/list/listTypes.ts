import {
  GraphQLInt,
  GraphQLString,
  GraphQLNonNull,
  GraphQLObjectType,
  GraphQLBoolean,
  GraphQLUnionType,
  GraphQLList
} from 'graphql'
import { globalIdField, connectionDefinitions, connectionArgs } from 'graphql-relay'
import { applyCursorToQuery, buildConnection } from '../../graphql/cursorPagination'
import { nodeInterface } from '../../graphql/nodeInterface'
import { entityRegister } from '../../graphql/entityHelpers'
import { ListModel, LIST_TYPES } from './listModel'
import { ListItemModel } from './listItemModel'

const modelMap: Record<string, () => any> = {
  shows: () => require('../show/showModel').ShowModel,
  venues: () => require('../venue/venueModel').VenueModel,
  runs: () => require('../run/runModel').RunModel,
  performances: () => require('../performance/performanceModel').PerformanceModel,
  people: () => require('../person/personModel').PersonModel
}

const typeMap: Record<string, () => any> = {
  shows: () => require('../show/showTypes').showType,
  venues: () => require('../venue/venueTypes').venueType,
  runs: () => require('../run/runTypes').runType,
  performances: () => require('../performance/performanceTypes').performanceType,
  people: () => require('../person/personTypes').personType
}

export function getModelForListType(listType: string) {
  return modelMap[listType]?.()
}

const typeNameMap: Record<string, string> = {
  shows: 'Show',
  venues: 'Venue',
  runs: 'Run',
  performances: 'Performance',
  people: 'Person'
}

export const ListableItem = new GraphQLUnionType({
  name: 'ListableItem',
  types: () => LIST_TYPES.map(t => typeMap[t]()),
  resolveType: (obj: any) => {
    if (obj._listType) return typeNameMap[obj._listType]
    return undefined
  }
})

export const listItemType: GraphQLObjectType = new GraphQLObjectType({
  name: 'ListItem',
  interfaces: () => [nodeInterface],
  fields: () => {
    const { userType } = require('../user/userTypes')
    return {
      id: globalIdField('ListItem', item => item._id),
      item: {
        type: ListableItem,
        resolve: async (listItem: any) => {
          const list = await ListModel.findById(listItem.list)
          if (!list) return null
          const Model = getModelForListType(list.listType)
          if (!Model) return null
          const doc = await Model.findById(listItem.itemId)
          if (!doc) return null
          const obj = doc.toObject({ virtuals: true })
          obj._listType = list.listType
          return obj
        }
      },
      position: {
        type: GraphQLInt,
        resolve: (item: any) => item.position
      },
      note: {
        type: GraphQLString,
        resolve: (item: any) => item.note
      },
      addedBy: {
        type: userType,
        resolve: async (item: any, _args: any, ctx: any) => {
          if (!item.addedBy) return null
          if (ctx.loaders) return ctx.loaders.userLoader.load(item.addedBy.toString())
          const { UserModel } = require('../user/userModel')
          return UserModel.findById(item.addedBy)
        }
      },
      createdAt: {
        type: GraphQLString,
        resolve: (item: any) => item.createdAt?.toISOString()
      }
    }
  }
})

export const { connectionType: ListItemConnection, edgeType: ListItemEdge } = connectionDefinitions({
  nodeType: listItemType
})

export const listType: GraphQLObjectType = new GraphQLObjectType({
  name: 'List',
  interfaces: () => [nodeInterface],
  fields: () => {
    const { userType } = require('../user/userTypes')
    const { UserConnection } = require('../user/userTypes')
    return {
      id: globalIdField('List', list => list._id),
      name: {
        type: new GraphQLNonNull(GraphQLString),
        resolve: (list: any) => list.name
      },
      slug: {
        type: new GraphQLNonNull(GraphQLString),
        resolve: (list: any) => list.slug
      },
      description: {
        type: GraphQLString,
        resolve: (list: any) => list.description
      },
      listType: {
        type: new GraphQLNonNull(GraphQLString),
        resolve: (list: any) => list.listType
      },
      isPublic: {
        type: GraphQLBoolean,
        resolve: (list: any) => list.isPublic
      },
      isEditorial: {
        type: GraphQLBoolean,
        resolve: (list: any) => list.isEditorial
      },
      isActive: {
        type: GraphQLBoolean,
        resolve: (list: any) => list.isActive
      },
      displayOrder: {
        type: GraphQLInt,
        resolve: (list: any) => list.displayOrder
      },
      owner: {
        type: userType,
        resolve: async (list: any, _args: any, ctx: any) => {
          if (ctx.loaders) return ctx.loaders.userLoader.load(list.owner.toString())
          const { UserModel } = require('../user/userModel')
          return UserModel.findById(list.owner)
        }
      },
      collaborators: {
        type: UserConnection,
        resolve: async (list: any, _args: any, ctx: any) => {
          if (!list.collaborators || list.collaborators.length === 0) {
            return { edges: [], pageInfo: { hasNextPage: false, hasPreviousPage: false } }
          }
          const users = ctx.loaders
            ? await Promise.all(list.collaborators.map((id: any) => ctx.loaders.userLoader.load(id.toString())))
            : await (require('../user/userModel').UserModel).find({ _id: { $in: list.collaborators } })
          return {
            edges: users.filter(Boolean).map((u: any) => ({ node: u, cursor: u._id.toString() })),
            pageInfo: { hasNextPage: false, hasPreviousPage: false }
          }
        }
      },
      itemCount: {
        type: GraphQLInt,
        resolve: (list: any) => list.itemCount
      },
      items: {
        type: ListItemConnection,
        description: 'Items in this list, ordered by position',
        args: { ...connectionArgs },
        resolve: async (list: any, args: any, ctx: any) => {
          // If no pagination args, use DataLoader for batching
          if (!args.first && !args.after && ctx.loaders) {
            const items = await ctx.loaders.listItemsByListLoader.load(list._id.toString())
            return {
              edges: items.map((i: any) => ({ node: i, cursor: i._id.toString() })),
              pageInfo: { hasNextPage: false, hasPreviousPage: false }
            }
          }
          const { filter, sort, limit } = applyCursorToQuery({ list: list._id }, {
            after: args.after, first: args.first, sortField: 'position', sortDirection: 1, maxLimit: 200
          })
          const items = await ListItemModel.find(filter).sort(sort).limit(limit).lean()
          return buildConnection(items, { first: args.first, sortField: 'position', maxLimit: 200 })
        }
      },
      isCollaborator: {
        type: GraphQLBoolean,
        description: 'Whether the current viewer is a collaborator on this list',
        resolve: (list: any, _args: any, ctx: any) => {
          if (!ctx.user) return false
          return list.collaborators?.some((c: any) => String(c) === ctx.user.id) || false
        }
      },
      isOwner: {
        type: GraphQLBoolean,
        description: 'Whether the current viewer owns this list',
        resolve: (list: any, _args: any, ctx: any) => {
          if (!ctx.user) return false
          return String(list.owner) === ctx.user.id
        }
      },
      createdAt: {
        type: GraphQLString,
        resolve: (list: any) => list.createdAt?.toISOString()
      },
      updatedAt: {
        type: GraphQLString,
        resolve: (list: any) => list.updatedAt?.toISOString()
      }
    }
  }
})

export const { connectionType: ListConnection, edgeType: ListEdge } = connectionDefinitions({
  nodeType: listType
})

entityRegister({
  type: listType,
  nodeResolver: async (id) => await ListModel.findById(id)
})

entityRegister({
  type: listItemType,
  nodeResolver: async (id) => await ListItemModel.findById(id)
})
