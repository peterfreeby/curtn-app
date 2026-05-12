import {
  GraphQLString,
  GraphQLNonNull,
  GraphQLObjectType,
  GraphQLBoolean,
  GraphQLInt,
  GraphQLList,
} from 'graphql'
import { nodeInterface } from '../../graphql/nodeInterface'
import { globalIdField, connectionDefinitions } from 'graphql-relay'
import { entityRegister } from '../../graphql/entityHelpers'
import { ClaimRequestModel } from './claimRequestModel'

// Polymorphic target sub-type. `kind` is one of venue / productionCompany / person;
// `targetId` is the MongoDB ObjectId as a string; `name` is the resolved display name.
const claimTargetType = new GraphQLObjectType({
  name: 'ClaimTarget',
  description: 'The unit being claimed (venue, productionCompany, or person).',
  fields: () => ({
    kind: {
      type: new GraphQLNonNull(GraphQLString),
      resolve: (t: any) => t.kind,
    },
    targetId: {
      type: new GraphQLNonNull(GraphQLString),
      resolve: (t: any) => t.id?.toString(),
    },
    name: {
      type: GraphQLString,
      description: 'The display name of the target unit, resolved at query time.',
      resolve: async (t: any) => {
        if (!t.kind || !t.id) return null
        if (t.kind === 'venue') {
          const { VenueModel } = require('../venue/venueModel')
          const v = await VenueModel.findById(t.id).select('name').lean()
          return v?.name ?? null
        }
        if (t.kind === 'productionCompany') {
          const { ProductionCompanyModel } = require('../productionCompany/productionCompanyModel')
          const c = await ProductionCompanyModel.findById(t.id).select('name').lean()
          return c?.name ?? null
        }
        if (t.kind === 'person') {
          const { PersonModel } = require('../person/personModel')
          const p = await PersonModel.findById(t.id).select('name').lean()
          return p?.name ?? null
        }
        return null
      }
    },
    slug: {
      type: GraphQLString,
      description: 'The slug of the target unit, for linking.',
      resolve: async (t: any) => {
        if (!t.kind || !t.id) return null
        if (t.kind === 'venue') {
          const { VenueModel } = require('../venue/venueModel')
          const v = await VenueModel.findById(t.id).select('slug').lean()
          return v?.slug ?? null
        }
        if (t.kind === 'productionCompany') {
          const { ProductionCompanyModel } = require('../productionCompany/productionCompanyModel')
          const c = await ProductionCompanyModel.findById(t.id).select('slug').lean()
          return c?.slug ?? null
        }
        if (t.kind === 'person') {
          const { PersonModel } = require('../person/personModel')
          const p = await PersonModel.findById(t.id).select('slug').lean()
          return p?.slug ?? null
        }
        return null
      }
    }
  })
})

// Phase 8 — verification signals surfaced on the claim. Read-only here; mutations
// (linkExternalProfile, verifyWebmaster, etc.) update the underlying document.

const externalProfileLinkType = new GraphQLObjectType({
  name: 'ExternalProfileLink',
  fields: () => ({
    url: { type: new GraphQLNonNull(GraphQLString), resolve: (l: any) => l.url },
    platform: { type: new GraphQLNonNull(GraphQLString), resolve: (l: any) => l.platform },
    verifiedAt: {
      type: GraphQLString,
      resolve: (l: any) => l.verifiedAt?.toISOString?.() ?? null,
    },
  }),
})

const trustGraphEndorsementType = new GraphQLObjectType({
  name: 'TrustGraphEndorsement',
  fields: () => ({
    grantingUnitKind: { type: GraphQLString, resolve: (e: any) => e.grantingUnit?.kind ?? null },
    grantingUnitId: {
      type: GraphQLString,
      resolve: (e: any) => e.grantingUnit?.id?.toString?.() ?? null,
    },
    grantedAt: {
      type: GraphQLString,
      resolve: (e: any) => e.grantedAt?.toISOString?.() ?? null,
    },
  }),
})

const claimSignalsType = new GraphQLObjectType({
  name: 'ClaimSignals',
  description: 'Phase 8 verification signals attached to a ClaimRequest.',
  fields: () => ({
    webmasterVerified: {
      type: new GraphQLNonNull(GraphQLBoolean),
      resolve: (s: any) => !!s?.webmasterVerified,
    },
    webmasterToken: { type: GraphQLString, resolve: (s: any) => s?.webmasterToken ?? null },
    webmasterTokenExpires: {
      type: GraphQLString,
      resolve: (s: any) => s?.webmasterTokenExpires?.toISOString?.() ?? null,
    },
    externalProfileLinks: {
      type: new GraphQLList(externalProfileLinkType),
      resolve: (s: any) => s?.externalProfileLinks ?? [],
    },
    trustGraphEndorsements: {
      type: new GraphQLList(trustGraphEndorsementType),
      resolve: (s: any) => s?.trustGraphEndorsements ?? [],
    },
    autoPromotionScore: {
      type: new GraphQLNonNull(GraphQLInt),
      resolve: (s: any) => s?.autoPromotionScore ?? 0,
    },
    autoPromotedAt: {
      type: GraphQLString,
      resolve: (s: any) => s?.autoPromotedAt?.toISOString?.() ?? null,
    },
  }),
})

export const claimRequestType = new GraphQLObjectType({
  name: 'ClaimRequest',
  description: 'A request from a user to claim a Venue, ProductionCompany, or Person, pending admin approval',
  interfaces: () => [nodeInterface],
  fields: () => {
    const { userType } = require('../user/userTypes')
    const { personType } = require('../person/personTypes')
    const { UserModel } = require('../user/userModel')
    const { PersonModel } = require('../person/personModel')

    return {
      id: globalIdField('ClaimRequest', cr => cr.id),
      user: {
        type: new GraphQLNonNull(userType),
        resolve: async (cr: any) => UserModel.findById(cr.user)
      },
      // Legacy Person-only field; nullable for polymorphic claims that target a
      // Venue or ProductionCompany. Prefer `target` going forward.
      person: {
        type: personType,
        resolve: async (cr: any) => cr.person ? PersonModel.findById(cr.person) : null
      },
      target: {
        type: claimTargetType,
        description: 'Polymorphic target (venue / productionCompany / person). Source of truth for Phase 2 onward.',
        resolve: (cr: any) => cr.target ?? null
      },
      status: {
        type: new GraphQLNonNull(GraphQLString),
        resolve: (cr: any) => cr.status
      },
      message: {
        type: GraphQLString,
        resolve: (cr: any) => cr.message
      },
      reviewerNotes: {
        type: GraphQLString,
        resolve: (cr: any) => cr.reviewerNotes ?? null
      },
      requestedAt: {
        type: new GraphQLNonNull(GraphQLString),
        resolve: (cr: any) => cr.requestedAt?.toISOString()
      },
      reviewedAt: {
        type: GraphQLString,
        resolve: (cr: any) => cr.reviewedAt?.toISOString()
      },
      reviewedBy: {
        type: userType,
        resolve: async (cr: any) => {
          if (!cr.reviewedBy) return null
          return UserModel.findById(cr.reviewedBy)
        }
      },
      createdAt: {
        type: GraphQLString,
        resolve: (cr: any) => cr.createdAt?.toISOString()
      },
      signals: {
        type: claimSignalsType,
        description: 'Phase 8 — verification signals (webmaster status, profile links, trust-graph endorsements, score).',
        resolve: (cr: any) => cr.signals ?? null
      },
    }
  }
})

export const { connectionType: ClaimRequestConnection, edgeType: ClaimRequestEdge } = connectionDefinitions({
  nodeType: claimRequestType
})

entityRegister({
  type: claimRequestType,
  nodeResolver: async (id) => await ClaimRequestModel.findById(id)
})
