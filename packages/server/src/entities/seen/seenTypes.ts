import {
  GraphQLString,
  GraphQLNonNull,
  GraphQLObjectType
} from 'graphql'
import { nodeInterface } from '../../graphql/nodeInterface'
import { globalIdField, connectionDefinitions } from 'graphql-relay'
import { entityRegister } from '../../graphql/entityHelpers'
import { SeenModel } from './seenModel'
import { userType } from '../user/userTypes'
import { UserModel } from '../user/userModel'

export const seenType = new GraphQLObjectType({
  name: 'Seen',
  description: 'A record of a user having seen a run',
  interfaces: () => [nodeInterface],
  fields: () => {
    const { runType } = require('../run/runTypes')
    const { showType } = require('../show/showTypes')
    return {
      id: globalIdField('Seen', seen => seen._id),
      user: {
        type: new GraphQLNonNull(userType),
        resolve: async (seen: any, _args: any, ctx: any) => {
          if (ctx.loaders) return ctx.loaders.userLoader.load(seen.user.toString())
          return UserModel.findById(seen.user)
        }
      },
      run: {
        // Nullable: a seen can outlive its run (e.g. the run was deleted).
        // Returning null lets the client skip the orphan instead of a dangling
        // ref nulling the whole edge node and crashing the list.
        type: runType,
        resolve: async (seen: any, _args: any, ctx: any) => {
          if (!seen.run) return null
          if (ctx.loaders) return ctx.loaders.runLoader.load(seen.run.toString())
          const { RunModel } = require('../run/runModel')
          return RunModel.findById(seen.run)
        }
      },
      show: {
        type: showType,
        resolve: async (seen: any, _args: any, ctx: any) => {
          if (!seen.show) return null
          if (ctx.loaders) return ctx.loaders.showLoader.load(seen.show.toString())
          const { ShowModel } = require('../show/showModel')
          return ShowModel.findById(seen.show)
        }
      },
      createdAt: {
        type: GraphQLString,
        resolve: seen => seen.createdAt?.toISOString()
      }
    }
  }
})

export const { connectionType: SeenConnection, edgeType: SeenEdge } = connectionDefinitions({
  nodeType: seenType
})

entityRegister({
  type: seenType,
  nodeResolver: async (id) => await SeenModel.findById(id)
})
