import { GraphQLList, GraphQLNonNull } from 'graphql'
import { dataSourceType } from '../dataSourceTypes'
import { DataSourceModel } from '../dataSourceModel'

// Phase 6 — claimant's connected sync sources, surfaced on the dashboard.
// Only returns rows the caller created (i.e., their own claimant-syncs).

export const myClaimantSyncs = {
  type: new GraphQLList(new GraphQLNonNull(dataSourceType)),
  description: "Sync DataSources the calling user created (purpose: 'claimant-sync')",
  resolve: async (_root: any, _args: any, ctx: any) => {
    if (!ctx.user) return []
    return DataSourceModel.find({
      createdBy: ctx.user.id,
      purpose: 'claimant-sync',
    }).sort({ createdAt: -1 })
  },
}
