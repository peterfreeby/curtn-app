import { GraphQLNonNull, GraphQLObjectType, GraphQLString } from 'graphql'
import { connectionDefinitions, globalIdField } from 'graphql-relay'
import { nodeInterface } from '../../graphql/nodeInterface'
import { entityRegister } from '../../graphql/entityHelpers'
import { BlockModel } from './blockModel'

// Phase 7 — Block GraphQL surface. `blockedUser` and `scopedTo` are flattened
// to sub-objects with display fields so the claimant dashboard and admin
// block-activity page can render without per-kind unions.

function getModelForKind(kind: string): any {
  switch (kind) {
    case 'Venue': return require('../venue/venueModel').VenueModel
    case 'ProductionCompany': return require('../productionCompany/productionCompanyModel').ProductionCompanyModel
    case 'Person': return require('../person/personModel').PersonModel
    default: return null
  }
}

const blockScopedToType = new GraphQLObjectType({
  name: 'BlockScopedTo',
  fields: () => ({
    kind: { type: new GraphQLNonNull(GraphQLString), resolve: (t: any) => t.kind },
    targetId: { type: new GraphQLNonNull(GraphQLString), resolve: (t: any) => t.id?.toString() },
    name: {
      type: GraphQLString,
      resolve: async (t: any) => {
        const Model = getModelForKind(t.kind)
        if (!Model) return null
        const doc: any = await Model.findById(t.id).select('name').lean()
        return doc?.name ?? null
      },
    },
    slug: {
      type: GraphQLString,
      resolve: async (t: any) => {
        const Model = getModelForKind(t.kind)
        if (!Model) return null
        const doc: any = await Model.findById(t.id).select('slug').lean()
        return doc?.slug ?? null
      },
    },
  }),
})

const blockUserSummaryType = new GraphQLObjectType({
  name: 'BlockUserSummary',
  fields: () => ({
    userId: { type: new GraphQLNonNull(GraphQLString), resolve: (u: any) => u._id?.toString() ?? u.id ?? '' },
    username: { type: GraphQLString, resolve: (u: any) => u.username ?? null },
    fullName: { type: GraphQLString, resolve: (u: any) => u.fullName ?? null },
  }),
})

export const blockType: GraphQLObjectType = new GraphQLObjectType({
  name: 'Block',
  description: 'A claimant-issued block preventing a specific user from proposing edits to a specific unit.',
  interfaces: () => [nodeInterface],
  fields: () => ({
    id: globalIdField('Block', t => t._id?.toString() ?? t.id),
    blockerId: { type: new GraphQLNonNull(GraphQLString), resolve: (t: any) => t.blocker?.toString() },
    blockedUser: {
      type: new GraphQLNonNull(blockUserSummaryType),
      resolve: async (t: any) => {
        const { UserModel } = require('../user/userModel')
        const u: any = await UserModel.findById(t.blockedUser).select('username fullName').lean()
        return u ?? { _id: t.blockedUser }
      },
    },
    blocker: {
      type: new GraphQLNonNull(blockUserSummaryType),
      resolve: async (t: any) => {
        const { UserModel } = require('../user/userModel')
        const u: any = await UserModel.findById(t.blocker).select('username fullName').lean()
        return u ?? { _id: t.blocker }
      },
    },
    scopedTo: { type: new GraphQLNonNull(blockScopedToType), resolve: (t: any) => t.scopedTo },
    reason: { type: GraphQLString, resolve: (t: any) => t.reason ?? null },
    createdAt: { type: new GraphQLNonNull(GraphQLString), resolve: (t: any) => t.createdAt?.toISOString() },
    revokedAt: { type: GraphQLString, resolve: (t: any) => t.revokedAt?.toISOString() ?? null },
  }),
})

export const { connectionType: BlockConnection } = connectionDefinitions({ nodeType: blockType })

entityRegister({
  type: blockType,
  nodeResolver: async (id) => await BlockModel.findById(id),
})
