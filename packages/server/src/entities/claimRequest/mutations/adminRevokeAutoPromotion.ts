import { GraphQLNonNull, GraphQLString } from 'graphql'
import { mutationWithClientMutationId } from 'graphql-relay'
import { errorField } from '../../../graphql/errorField'
import { claimRequestType } from '../claimRequestTypes'
import { ClaimRequestModel, ClaimTargetKind } from '../claimRequestModel'
import { VenueModel } from '../../venue/venueModel'
import { ProductionCompanyModel } from '../../productionCompany/productionCompanyModel'
import { PersonModel } from '../../person/personModel'
import { UserModel } from '../../user/userModel'
import { writeAuditLog } from '../../../services/auditLog/writeAuditLog'
import { createNotification } from '../../../services/notifications/createNotification'

// Phase 8 — Admin walks back an auto-promotion. Transitions the unit back to
// `unclaimed`, sets the claim status to `rejected` with an admin note, and
// fires a notification to the former claimant. AuditLog entries from the
// auto-promote remain (history is append-only).

const TARGET_KIND_TO_AUDIT_KIND: Record<ClaimTargetKind, 'Venue' | 'ProductionCompany' | 'Person'> = {
  venue: 'Venue',
  productionCompany: 'ProductionCompany',
  person: 'Person',
}

async function fetchUnit(kind: ClaimTargetKind, id: any): Promise<any> {
  if (kind === 'venue') return VenueModel.findById(id)
  if (kind === 'productionCompany') return ProductionCompanyModel.findById(id)
  if (kind === 'person') return PersonModel.findById(id)
  return null
}

export const adminRevokeAutoPromotionMutation = mutationWithClientMutationId({
  name: 'adminRevokeAutoPromotion',
  description: 'Admin reverts a prior auto-promotion. Unit returns to unclaimed; claimant notified.',
  inputFields: {
    claimRequestId: { type: new GraphQLNonNull(GraphQLString) },
    reason: { type: GraphQLString, description: 'Optional reason recorded in the AuditLog and claimant notification.' },
  },
  outputFields: {
    claimRequest: { type: claimRequestType, resolve: (r: any) => r.claimRequest },
    ...errorField,
  },
  mutateAndGetPayload: async (input, ctx) => {
    if (!ctx.user) return { error: 'Authentication required' }
    const adminUser = await UserModel.findById(ctx.user.id)
    if (!adminUser?.isAdmin) return { error: 'Admin access required' }

    const { claimRequestId, reason } = input as { claimRequestId: string; reason?: string }
    const claim = await ClaimRequestModel.findById(claimRequestId)
    if (!claim) return { error: 'Claim request not found' }
    if (!claim.signals?.autoPromotedAt) {
      return { error: 'This claim was not auto-promoted; use the standard claim review actions instead.' }
    }
    if (claim.status !== 'approved') {
      return { error: `Claim is in status ${claim.status}, cannot revoke.` }
    }
    if (!claim.target?.kind || !claim.target?.id) {
      return { error: 'Claim has no polymorphic target' }
    }

    const unit = await fetchUnit(claim.target.kind, claim.target.id)
    if (!unit) return { error: 'Target unit not found' }

    const oldDoc = unit.toObject ? unit.toObject() : { ...unit }

    // Only revert if the unit is still claimed by this user (don't accidentally
    // unclaim something a manual approval reassigned).
    if (unit.claimedBy && claim.user && unit.claimedBy.toString() !== claim.user.toString()) {
      return { error: 'Unit has been re-assigned since auto-promotion. Cannot safely revoke.' }
    }

    unit.claimState = 'unclaimed'
    unit.claimedBy = null
    unit.claimedAt = null
    await unit.save()

    claim.status = 'rejected'
    ;(claim as any).reviewedAt = new Date()
    ;(claim as any).reviewedBy = adminUser._id
    if (reason) claim.reviewerNotes = `[Auto-promotion revoked] ${reason}`
    else claim.reviewerNotes = '[Auto-promotion revoked by admin]'
    await claim.save()

    await writeAuditLog({
      target: {
        kind: TARGET_KIND_TO_AUDIT_KIND[claim.target.kind],
        id: unit._id,
      },
      author: {
        kind: 'User',
        userId: adminUser._id,
        label: `Admin revoked auto-promotion${reason ? `: ${reason}` : ''}`,
      },
      oldDoc,
      newDoc: unit.toObject(),
      approvalSource: 'admin-override',
      approvalContext: {
        revokedAutoPromotion: true,
        claimRequestId: claim._id.toString(),
        reason: reason ?? null,
      },
    })

    await createNotification({
      recipient: claim.user,
      kind: 'claim_declined',
      context: {
        targetKind: claim.target.kind,
        targetId: unit._id.toString(),
        targetName: unit.name,
        targetSlug: unit.slug ?? null,
        reviewerNotes: claim.reviewerNotes ?? null,
        revokedAutoPromotion: true,
      },
    })

    return { claimRequest: claim }
  },
})
