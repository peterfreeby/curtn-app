import { GraphQLNonNull, GraphQLString } from 'graphql'

// GraphQL field configs for any claimable unit (Venue, ProductionCompany, Person).
// Spread into each entity's `fields` thunk. Mirrors the shape of claimableFieldsSchema.
// Phase 1 exposes these as readable only; mutations come in Phase 2.

export function claimableFieldsGraphQL() {
  // Lazy require to avoid circular import with userType.
  const { userType } = require('../entities/user/userTypes')

  return {
    claimState: {
      type: new GraphQLNonNull(GraphQLString),
      description: 'Claim ownership state: unclaimed | provisionally-claimed | claimed-passive | claimed-synced',
      resolve: (unit: any) => unit.claimState,
    },
    claimedBy: {
      type: userType,
      description: 'User who has claimed this unit (null when unclaimed/provisional)',
      resolve: async (unit: any, _args: any, ctx: any) => {
        if (!unit.claimedBy) return null
        if (ctx.loaders) return ctx.loaders.userLoader.load(unit.claimedBy.toString())
        const { UserModel } = require('../entities/user/userModel')
        return UserModel.findById(unit.claimedBy)
      },
    },
    claimedAt: {
      type: GraphQLString,
      description: 'When the claim was approved (ISO string)',
      resolve: (unit: any) => unit.claimedAt?.toISOString(),
    },
    syncHealth: {
      type: GraphQLString,
      description: 'Sync feed health (healthy | stale); only meaningful when claimState is claimed-synced',
      resolve: (unit: any) => unit.syncHealth,
    },
    syncSourceConnectedAt: {
      type: GraphQLString,
      description: 'When the claimant connected a sync source (ISO string)',
      resolve: (unit: any) => unit.syncSourceConnectedAt?.toISOString(),
    },
    lastClaimantActivityAt: {
      type: GraphQLString,
      description: 'Most recent claimant activity timestamp (for auto-expire; ISO string)',
      resolve: (unit: any) => unit.lastClaimantActivityAt?.toISOString(),
    },
  }
}
