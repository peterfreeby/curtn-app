import { GraphQLNonNull, GraphQLString } from 'graphql'
import { mutationWithClientMutationId } from 'graphql-relay'
import { Types } from 'mongoose'
import { errorField } from '../../../graphql/errorField'
import { claimTransferType } from '../claimTransferTypes'
import { ClaimTransferModel } from '../claimTransferModel'
import { UserModel } from '../../user/userModel'
import { VenueModel } from '../../venue/venueModel'
import { ProductionCompanyModel } from '../../productionCompany/productionCompanyModel'
import { PersonModel } from '../../person/personModel'
import { createNotification } from '../../../services/notifications/createNotification'

const VALID_KINDS = ['venue', 'productionCompany', 'person'] as const
type TargetKind = typeof VALID_KINDS[number]

// Current claimant initiates a transfer to another user (by username). Recipient
// gets a transfer_received Notification and accepts/declines via the dashboard.

export const initiateTransfer = mutationWithClientMutationId({
  name: 'initiateTransfer',
  description: 'Initiate a transfer of a claim to another user. Pending until they accept or decline.',
  inputFields: {
    targetKind: { type: new GraphQLNonNull(GraphQLString), description: 'venue | productionCompany | person' },
    targetId: { type: new GraphQLNonNull(GraphQLString), description: 'MongoDB ObjectId of the claimed unit' },
    toUsername: { type: new GraphQLNonNull(GraphQLString), description: 'Username of the user to transfer to' },
    message: { type: GraphQLString, description: 'Optional note for the recipient' },
  },
  outputFields: {
    transfer: { type: claimTransferType, resolve: (r: any) => r.transfer },
    ...errorField,
  },
  mutateAndGetPayload: async (input, ctx) => {
    if (!ctx.user) return { error: 'Authentication required' }

    const { targetKind, targetId, toUsername, message } = input as {
      targetKind: string
      targetId: string
      toUsername: string
      message?: string
    }

    if (!VALID_KINDS.includes(targetKind as TargetKind)) {
      return { error: `Invalid targetKind. Must be one of: ${VALID_KINDS.join(', ')}` }
    }

    const unit = await fetchUnit(targetKind as TargetKind, targetId)
    if (!unit) return { error: `${targetKind} not found` }

    if (!unit.claimedBy || unit.claimedBy.toString() !== ctx.user.id) {
      return { error: 'You can only transfer a claim you currently hold.' }
    }

    const recipient = await UserModel.findOne({ username: toUsername })
    if (!recipient) return { error: `No user with username @${toUsername}` }
    if (recipient._id.toString() === ctx.user.id) {
      return { error: "You can't transfer a claim to yourself." }
    }

    const existing = await ClaimTransferModel.findOne({
      fromUser: ctx.user.id,
      toUser: recipient._id,
      'target.kind': targetKind,
      'target.id': unit._id,
      status: 'pending',
    })
    if (existing) {
      return { error: `You already have a pending transfer to @${toUsername} for this unit.` }
    }

    const transfer = await new ClaimTransferModel({
      fromUser: new Types.ObjectId(ctx.user.id),
      toUser: recipient._id,
      target: { kind: targetKind, id: unit._id },
      message: message?.trim() || undefined,
    }).save()

    const fromUser = await UserModel.findById(ctx.user.id).select('username').lean()

    await createNotification({
      recipient: recipient._id,
      kind: 'transfer_received',
      context: {
        transferId: transfer._id.toString(),
        targetKind,
        targetId: unit._id.toString(),
        targetName: unit.name,
        targetSlug: unit.slug ?? null,
        fromUsername: fromUser?.username ?? null,
        message: message?.trim() || null,
        expiresAt: transfer.expiresAt.toISOString(),
      }
    })

    return { transfer }
  }
})

async function fetchUnit(kind: TargetKind, id: string): Promise<any> {
  if (kind === 'venue') return VenueModel.findById(id)
  if (kind === 'productionCompany') return ProductionCompanyModel.findById(id)
  if (kind === 'person') return PersonModel.findById(id)
  return null
}
