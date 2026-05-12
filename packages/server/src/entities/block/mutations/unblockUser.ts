import { GraphQLBoolean, GraphQLNonNull, GraphQLString } from 'graphql'
import { mutationWithClientMutationId } from 'graphql-relay'
import { Types } from 'mongoose'
import { errorField } from '../../../graphql/errorField'
import { blockType } from '../blockTypes'
import { BlockModel } from '../blockModel'
import { UserModel } from '../../user/userModel'
import { AuditLogModel } from '../../auditLog/auditLogModel'

// Phase 7 — flip `revokedAt` on a block. Block rows are never deleted so the
// audit history stays intact. Caller must be the original blocker or admin.
export const unblockUser = mutationWithClientMutationId({
  name: 'unblockUser',
  description: 'Lift a block you previously issued. The original block row is preserved (revokedAt set).',
  inputFields: {
    blockId: { type: new GraphQLNonNull(GraphQLString) },
  },
  outputFields: {
    block: { type: blockType, resolve: (r: any) => r.block },
    success: { type: GraphQLBoolean, resolve: (r: any) => !!r.success },
    ...errorField,
  },
  mutateAndGetPayload: async (input, ctx) => {
    if (!ctx.user) return { error: 'Authentication required' }

    const { blockId } = input as { blockId: string }

    const block = await BlockModel.findById(blockId)
    if (!block) return { error: 'Block not found' }
    if (block.revokedAt) return { error: 'Block is already revoked' }

    const callerUser = await UserModel.findById(ctx.user.id).select('isAdmin').lean()
    const isAdmin = !!callerUser?.isAdmin

    if (!isAdmin && block.blocker.toString() !== ctx.user.id) {
      return { error: 'Only the original blocker or an admin can revoke this block.' }
    }

    block.revokedAt = new Date()
    block.revokedBy = new Types.ObjectId(ctx.user.id)
    await block.save()

    // Audit log row on the unit. Same pattern as block creation — written
    // directly so editCount isn't bumped.
    await AuditLogModel.create({
      target: { kind: block.scopedTo.kind as any, id: block.scopedTo.id },
      author: {
        kind: 'User',
        userId: new Types.ObjectId(ctx.user.id),
      },
      diff: { _block: { old: { blockedUserId: block.blockedUser.toString() }, new: null } },
      approvalSource: 'admin-override',
      approvalContext: {
        action: 'block_revoked',
        blockId: block._id.toString(),
        blockedUserId: block.blockedUser.toString(),
      },
      isRevert: false,
      revertOf: null,
    })

    return { block, success: true }
  },
})
