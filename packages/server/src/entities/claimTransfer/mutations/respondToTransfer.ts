import { GraphQLBoolean, GraphQLNonNull, GraphQLString } from 'graphql'
import { mutationWithClientMutationId } from 'graphql-relay'
import { errorField } from '../../../graphql/errorField'
import { claimTransferType } from '../claimTransferTypes'
import { ClaimTransferModel } from '../claimTransferModel'
import { UserModel } from '../../user/userModel'
import { VenueModel } from '../../venue/venueModel'
import { ProductionCompanyModel } from '../../productionCompany/productionCompanyModel'
import { PersonModel } from '../../person/personModel'
import { createNotification } from '../../../services/notifications/createNotification'

// Recipient accepts or declines a transfer. On accept, the claim moves
// (unit.claimedBy is rewritten and the original claimant immediately loses
// the approval gate). On decline, the transfer is marked declined and the
// original claimant is notified.

export const respondToTransfer = mutationWithClientMutationId({
  name: 'respondToTransfer',
  description: 'Recipient responds to a pending claim transfer.',
  inputFields: {
    transferId: { type: new GraphQLNonNull(GraphQLString), description: 'MongoDB ObjectId of the ClaimTransfer' },
    accept: { type: new GraphQLNonNull(GraphQLBoolean), description: 'true to accept, false to decline' },
  },
  outputFields: {
    transfer: { type: claimTransferType, resolve: (r: any) => r.transfer },
    ...errorField,
  },
  mutateAndGetPayload: async (input, ctx) => {
    if (!ctx.user) return { error: 'Authentication required' }

    const { transferId, accept } = input as { transferId: string, accept: boolean }

    const transfer = await ClaimTransferModel.findById(transferId)
    if (!transfer) return { error: 'Transfer not found' }
    if (transfer.toUser.toString() !== ctx.user.id) {
      return { error: 'This transfer was not directed to you.' }
    }
    if (transfer.status !== 'pending') {
      return { error: `Transfer is already ${transfer.status}.` }
    }
    if (transfer.expiresAt && transfer.expiresAt.getTime() < Date.now()) {
      transfer.status = 'expired'
      transfer.respondedAt = new Date()
      await transfer.save()
      return { error: 'This transfer has expired.', transfer }
    }

    const unit = await fetchUnit(transfer.target.kind, transfer.target.id.toString())
    if (!unit) return { error: `${transfer.target.kind} not found` }

    if (accept) {
      // Confirm the sender still holds the claim (it could've expired or been transferred via another path)
      if (!unit.claimedBy || unit.claimedBy.toString() !== transfer.fromUser.toString()) {
        transfer.status = 'declined'
        transfer.respondedAt = new Date()
        await transfer.save()
        return { error: 'The sender no longer holds this claim. Transfer cancelled.', transfer }
      }

      // Execute the transfer
      unit.claimedBy = transfer.toUser
      unit.claimedAt = new Date()
      unit.lastClaimantActivityAt = new Date()
      await unit.save()

      transfer.status = 'accepted'
      transfer.respondedAt = new Date()
      await transfer.save()

      const recipient = await UserModel.findById(transfer.toUser).select('username').lean()

      await createNotification({
        recipient: transfer.fromUser,
        kind: 'transfer_accepted',
        context: {
          transferId: transfer._id.toString(),
          targetKind: transfer.target.kind,
          targetId: unit._id.toString(),
          targetName: unit.name,
          targetSlug: unit.slug ?? null,
          toUsername: recipient?.username ?? null,
        }
      })

      return { transfer }
    }

    // Decline
    transfer.status = 'declined'
    transfer.respondedAt = new Date()
    await transfer.save()

    const recipient = await UserModel.findById(transfer.toUser).select('username').lean()

    await createNotification({
      recipient: transfer.fromUser,
      kind: 'transfer_declined',
      context: {
        transferId: transfer._id.toString(),
        targetKind: transfer.target.kind,
        targetId: unit._id.toString(),
        targetName: unit.name,
        targetSlug: unit.slug ?? null,
        toUsername: recipient?.username ?? null,
      }
    })

    return { transfer }
  }
})

async function fetchUnit(kind: string, id: string): Promise<any> {
  if (kind === 'venue') return VenueModel.findById(id)
  if (kind === 'productionCompany') return ProductionCompanyModel.findById(id)
  if (kind === 'person') return PersonModel.findById(id)
  return null
}
