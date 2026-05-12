import { GraphQLNonNull, GraphQLString } from 'graphql'
import { mutationWithClientMutationId } from 'graphql-relay'
import { Types } from 'mongoose'
import { errorField } from '../../../graphql/errorField'
import { blockType } from '../blockTypes'
import { BlockModel, BlockScopedKind } from '../blockModel'
import { UserModel } from '../../user/userModel'
import { VenueModel } from '../../venue/venueModel'
import { ProductionCompanyModel } from '../../productionCompany/productionCompanyModel'
import { PersonModel } from '../../person/personModel'
import { AuditLogModel } from '../../auditLog/auditLogModel'

const SCOPED_KINDS: BlockScopedKind[] = ['Venue', 'ProductionCompany', 'Person']

async function fetchUnit(kind: BlockScopedKind, id: string | Types.ObjectId): Promise<any> {
  if (kind === 'Venue') return VenueModel.findById(id)
  if (kind === 'ProductionCompany') return ProductionCompanyModel.findById(id)
  if (kind === 'Person') return PersonModel.findById(id)
  return null
}

// Phase 7 — block a specific user from proposing edits to a specific unit.
// Only the unit's claimant or an admin can issue a block. Writes a Phase-3
// AuditLog row on the granting unit attributed to the claimant so admin
// tooling (block-activity dashboard) can flag overuse.
export const blockUser = mutationWithClientMutationId({
  name: 'blockUser',
  description: 'Block a user from proposing edits to a unit you claim. Silent from the blocked user’s perspective.',
  inputFields: {
    scopedToKind: { type: new GraphQLNonNull(GraphQLString), description: 'Venue | ProductionCompany | Person' },
    scopedToId: { type: new GraphQLNonNull(GraphQLString) },
    blockedUserId: { type: new GraphQLNonNull(GraphQLString) },
    reason: { type: GraphQLString, description: 'Private — admin-visible only.' },
  },
  outputFields: {
    block: { type: blockType, resolve: (r: any) => r.block },
    ...errorField,
  },
  mutateAndGetPayload: async (input, ctx) => {
    if (!ctx.user) return { error: 'Authentication required' }

    const { scopedToKind, scopedToId, blockedUserId, reason } = input as {
      scopedToKind: string
      scopedToId: string
      blockedUserId: string
      reason?: string
    }

    if (!SCOPED_KINDS.includes(scopedToKind as BlockScopedKind)) {
      return { error: `Invalid scopedToKind. Must be one of: ${SCOPED_KINDS.join(', ')}` }
    }

    if (blockedUserId === ctx.user.id) {
      return { error: "You can't block yourself." }
    }

    const callerUser = await UserModel.findById(ctx.user.id).select('isAdmin').lean()
    const isAdmin = !!callerUser?.isAdmin

    const unit = await fetchUnit(scopedToKind as BlockScopedKind, scopedToId)
    if (!unit) return { error: `${scopedToKind} not found` }

    if (!isAdmin) {
      if (!unit.claimedBy || unit.claimedBy.toString() !== ctx.user.id) {
        return { error: 'Only the claimant of this unit can issue a block.' }
      }
    }

    const blockedUser = await UserModel.findById(blockedUserId).select('_id isAdmin').lean()
    if (!blockedUser) return { error: 'Blocked user not found' }
    if (blockedUser.isAdmin) {
      return { error: "You can't block an admin." }
    }

    const existing = await BlockModel.findOne({
      blocker: new Types.ObjectId(ctx.user.id),
      blockedUser: new Types.ObjectId(blockedUserId),
      'scopedTo.kind': scopedToKind,
      'scopedTo.id': new Types.ObjectId(scopedToId),
      revokedAt: null,
    })
    if (existing) {
      return { error: 'This user is already blocked on this unit.' }
    }

    const created = await new BlockModel({
      blocker: new Types.ObjectId(ctx.user.id),
      blockedUser: new Types.ObjectId(blockedUserId),
      scopedTo: { kind: scopedToKind, id: new Types.ObjectId(scopedToId) },
      reason: reason ?? '',
    }).save()

    // Audit log row on the granting unit attributed to the blocker. We write
    // directly (rather than via writeAuditLog) so the block creation doesn't
    // bump the blocker's editCount — a block isn't an edit.
    await AuditLogModel.create({
      target: { kind: scopedToKind as any, id: new Types.ObjectId(scopedToId) },
      author: {
        kind: 'User',
        userId: new Types.ObjectId(ctx.user.id),
      },
      diff: { _block: { old: null, new: { blockedUserId, blockId: created._id.toString() } } },
      approvalSource: 'admin-override',
      approvalContext: {
        action: 'block_created',
        blockId: created._id.toString(),
        blockedUserId,
        reason: reason ?? null,
      },
      isRevert: false,
      revertOf: null,
    })

    return { block: created }
  },
})
