import { GraphQLList } from 'graphql'
import { claimTransferType } from '../claimTransferTypes'
import { ClaimTransferModel } from '../claimTransferModel'

export const claimTransferQueries = {
  myPendingTransfers: {
    type: new GraphQLList(claimTransferType),
    description: "Claim transfers awaiting the current user's response (received).",
    resolve: async (_: any, _args: any, ctx: any) => {
      if (!ctx.user) return []
      return ClaimTransferModel.find({
        toUser: ctx.user.id,
        status: 'pending',
        expiresAt: { $gt: new Date() },
      })
        .sort({ createdAt: -1 })
        .lean()
    }
  },
  myInitiatedTransfers: {
    type: new GraphQLList(claimTransferType),
    description: 'Claim transfers the current user has initiated.',
    resolve: async (_: any, _args: any, ctx: any) => {
      if (!ctx.user) return []
      return ClaimTransferModel.find({ fromUser: ctx.user.id })
        .sort({ createdAt: -1 })
        .limit(50)
        .lean()
    }
  }
}
