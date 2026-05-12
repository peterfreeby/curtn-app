import {
  GraphQLList,
  GraphQLNonNull,
  GraphQLObjectType,
  GraphQLString,
} from 'graphql'
import { connectionDefinitions, globalIdField } from 'graphql-relay'
import { nodeInterface } from '../../graphql/nodeInterface'
import { entityRegister } from '../../graphql/entityHelpers'
import { TrustedEditorModel } from './trustedEditorModel'

// Phase 5 — TrustedEditor GraphQL surface. Polymorphic recipient/grantedOn are
// flattened to (kind, targetId, name, slug) sub-objects so the client can
// render without per-kind unions. Same pattern as ProposalTarget.

function getModelForKind(kind: string): any {
  switch (kind) {
    case 'Venue': return require('../venue/venueModel').VenueModel
    case 'ProductionCompany': return require('../productionCompany/productionCompanyModel').ProductionCompanyModel
    case 'Person': return require('../person/personModel').PersonModel
    case 'User': return require('../user/userModel').UserModel
    default: return null
  }
}

const trustedEditorGrantedOnType = new GraphQLObjectType({
  name: 'TrustedEditorGrantedOn',
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

const trustedEditorRecipientType = new GraphQLObjectType({
  name: 'TrustedEditorRecipient',
  fields: () => ({
    kind: { type: new GraphQLNonNull(GraphQLString), resolve: (r: any) => r.kind },
    targetId: { type: new GraphQLNonNull(GraphQLString), resolve: (r: any) => r.id?.toString() },
    name: {
      type: GraphQLString,
      resolve: async (r: any) => {
        const Model = getModelForKind(r.kind)
        if (!Model) return null
        if (r.kind === 'User') {
          const doc: any = await Model.findById(r.id).select('username fullName').lean()
          return doc?.fullName ?? doc?.username ?? null
        }
        const doc: any = await Model.findById(r.id).select('name').lean()
        return doc?.name ?? null
      },
    },
    slug: {
      type: GraphQLString,
      resolve: async (r: any) => {
        const Model = getModelForKind(r.kind)
        if (!Model) return null
        if (r.kind === 'User') {
          const doc: any = await Model.findById(r.id).select('username').lean()
          return doc?.username ?? null
        }
        const doc: any = await Model.findById(r.id).select('slug').lean()
        return doc?.slug ?? null
      },
    },
  }),
})

export const trustedEditorType: GraphQLObjectType = new GraphQLObjectType({
  name: 'TrustedEditor',
  description: 'A directional grant from a claimed unit to a recipient (user or unit), letting the recipient auto-publish within scope.',
  interfaces: () => [nodeInterface],
  fields: () => ({
    id: globalIdField('TrustedEditor', t => t._id?.toString() ?? t.id),
    grantedOn: { type: new GraphQLNonNull(trustedEditorGrantedOnType), resolve: (t: any) => t.grantedOn },
    recipient: { type: new GraphQLNonNull(trustedEditorRecipientType), resolve: (t: any) => t.recipient },
    scope: {
      type: new GraphQLNonNull(new GraphQLList(new GraphQLNonNull(GraphQLString))),
      resolve: (t: any) => t.scope ?? [],
    },
    roleTemplate: { type: new GraphQLNonNull(GraphQLString), resolve: (t: any) => t.roleTemplate },
    grantedBy: { type: new GraphQLNonNull(GraphQLString), resolve: (t: any) => t.grantedBy?.toString() },
    grantedAt: { type: new GraphQLNonNull(GraphQLString), resolve: (t: any) => t.grantedAt?.toISOString() },
    revokedAt: { type: GraphQLString, resolve: (t: any) => t.revokedAt?.toISOString() ?? null },
    revokedBy: { type: GraphQLString, resolve: (t: any) => t.revokedBy?.toString() ?? null },
    createdAt: { type: new GraphQLNonNull(GraphQLString), resolve: (t: any) => t.createdAt?.toISOString() },
  }),
})

export const { connectionType: TrustedEditorConnection } = connectionDefinitions({
  nodeType: trustedEditorType,
})

entityRegister({
  type: trustedEditorType,
  nodeResolver: async (id) => await TrustedEditorModel.findById(id),
})
