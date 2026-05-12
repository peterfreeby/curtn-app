import { GraphQLList, GraphQLNonNull, GraphQLObjectType, GraphQLString } from 'graphql'
import { VenueModel } from '../../venue/venueModel'
import { ProductionCompanyModel } from '../../productionCompany/productionCompanyModel'
import { PersonModel } from '../../person/personModel'
import { ClaimRequestModel } from '../claimRequestModel'
import { claimRequestType } from '../claimRequestTypes'

// Two queries that power the claimant dashboard (Phase 2):
//   - myClaims: units (Venue/Company/Person) where claimedBy === current user
//   - myClaimRequests: pending claim requests the current user has submitted

// Lightweight polymorphic shape for the dashboard list. Distinct from the
// ClaimTarget on ClaimRequest because here we also want the active claimState
// + claimedAt of the unit itself.
const myClaimType = new GraphQLObjectType({
  name: 'MyClaim',
  description: 'A unit the current user has claimed (active claim).',
  fields: () => ({
    kind: {
      type: new GraphQLNonNull(GraphQLString),
      resolve: (c: any) => c.kind,
    },
    targetId: {
      type: new GraphQLNonNull(GraphQLString),
      resolve: (c: any) => c.id?.toString() ?? '',
    },
    name: {
      type: new GraphQLNonNull(GraphQLString),
      resolve: (c: any) => c.name,
    },
    slug: {
      type: new GraphQLNonNull(GraphQLString),
      resolve: (c: any) => c.slug,
    },
    claimState: {
      type: new GraphQLNonNull(GraphQLString),
      resolve: (c: any) => c.claimState,
    },
    claimedAt: {
      type: GraphQLString,
      resolve: (c: any) => c.claimedAt?.toISOString?.() ?? null,
    },
    syncHealth: {
      type: GraphQLString,
      resolve: (c: any) => c.syncHealth ?? null,
    },
  }),
})

export const myDashboardQueries = {
  myClaims: {
    type: new GraphQLList(myClaimType),
    description: 'Units (Venue, ProductionCompany, Person) currently claimed by the authenticated user.',
    resolve: async (_: any, _args: any, ctx: any) => {
      if (!ctx.user) return []

      const [venues, companies, persons] = await Promise.all([
        VenueModel.find({ claimedBy: ctx.user.id })
          .select('_id name slug claimState claimedAt syncHealth')
          .lean(),
        ProductionCompanyModel.find({ claimedBy: ctx.user.id })
          .select('_id name slug claimState claimedAt syncHealth')
          .lean(),
        PersonModel.find({ claimedBy: ctx.user.id })
          .select('_id name slug claimState claimedAt syncHealth')
          .lean(),
      ])

      const items = [
        ...venues.map(v => ({ kind: 'venue', id: v._id, name: v.name, slug: v.slug, claimState: v.claimState, claimedAt: v.claimedAt, syncHealth: v.syncHealth })),
        ...companies.map(c => ({ kind: 'productionCompany', id: c._id, name: c.name, slug: c.slug, claimState: c.claimState, claimedAt: c.claimedAt, syncHealth: c.syncHealth })),
        ...persons.map(p => ({ kind: 'person', id: p._id, name: p.name, slug: p.slug, claimState: p.claimState, claimedAt: p.claimedAt, syncHealth: p.syncHealth })),
      ]

      // Newest claim first
      items.sort((a, b) => {
        const da = a.claimedAt ? new Date(a.claimedAt).getTime() : 0
        const db = b.claimedAt ? new Date(b.claimedAt).getTime() : 0
        return db - da
      })

      return items
    }
  },

  myClaimRequests: {
    type: new GraphQLList(claimRequestType),
    description: 'All claim requests the current user has submitted (across statuses, newest first).',
    resolve: async (_: any, _args: any, ctx: any) => {
      if (!ctx.user) return []
      return ClaimRequestModel.find({ user: ctx.user.id })
        .sort({ requestedAt: -1 })
        .limit(100)
        .lean()
    }
  }
}
