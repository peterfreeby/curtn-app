import { GraphQLNonNull, GraphQLString } from 'graphql'
import { mutationWithClientMutationId } from 'graphql-relay'
import { Types } from 'mongoose'
import { errorField } from '../../../graphql/errorField'
import { trustedEditorType } from '../trustedEditorTypes'
import { TrustedEditorModel } from '../trustedEditorModel'
import { UserModel } from '../../user/userModel'
import { createNotification } from '../../../services/notifications/createNotification'
import { writeAuditLog } from '../../../services/auditLog/writeAuditLog'
import { VenueModel } from '../../venue/venueModel'
import { ProductionCompanyModel } from '../../productionCompany/productionCompanyModel'
import { PersonModel } from '../../person/personModel'

// Phase 5 — revokeTrustedEditor. Sets revokedAt/revokedBy on the grant; writes
// a one-off AuditLog row on the granting unit attributed to the revoker so the
// edit-history surface shows trust changes alongside content edits. canPerform
// filters revoked grants out immediately — there's no grace period.

async function fetchUnit(kind: 'Venue' | 'ProductionCompany' | 'Person', id: Types.ObjectId): Promise<any> {
  if (kind === 'Venue') return VenueModel.findById(id).lean()
  if (kind === 'ProductionCompany') return ProductionCompanyModel.findById(id).lean()
  if (kind === 'Person') return PersonModel.findById(id).lean()
  return null
}

export const revokeTrustedEditor = mutationWithClientMutationId({
  name: 'revokeTrustedEditor',
  description: 'Revoke a trusted-editor grant. Immediately stops auto-publish for the recipient.',
  inputFields: {
    trustedEditorId: { type: new GraphQLNonNull(GraphQLString) },
  },
  outputFields: {
    trustedEditor: { type: trustedEditorType, resolve: (r: any) => r.trustedEditor },
    ...errorField,
  },
  mutateAndGetPayload: async (input, ctx) => {
    if (!ctx.user) return { error: 'Authentication required' }
    const { trustedEditorId } = input as { trustedEditorId: string }

    const grant = await TrustedEditorModel.findById(trustedEditorId)
    if (!grant) return { error: 'Trusted editor grant not found' }
    if (grant.revokedAt) return { error: 'This grant has already been revoked.' }

    const adminUser = await UserModel.findById(ctx.user.id).select('isAdmin').lean()
    const isAdmin = !!adminUser?.isAdmin

    // Either the original granter or an admin can revoke. Claimants of the
    // granting unit can also revoke if they took over via transfer — check
    // against the current claimedBy too.
    const grantingUnit = await fetchUnit(grant.grantedOn.kind, grant.grantedOn.id)
    const currentClaimantId = grantingUnit?.claimedBy?.toString() ?? null
    const isGranter = grant.grantedBy.toString() === ctx.user.id
    const isCurrentClaimant = !!currentClaimantId && currentClaimantId === ctx.user.id
    if (!isAdmin && !isGranter && !isCurrentClaimant) {
      return { error: 'Only the grantor, the current claimant, or an admin can revoke this grant.' }
    }

    grant.revokedAt = new Date()
    grant.revokedBy = new Types.ObjectId(ctx.user.id)
    await grant.save()

    // Audit row on the granting unit. Use a snapshot-style diff so the
    // history accordion can render meaningful context.
    if (grantingUnit) {
      await writeAuditLog({
        target: { kind: grant.grantedOn.kind, id: grant.grantedOn.id },
        author: {
          kind: 'User',
          userId: new Types.ObjectId(ctx.user.id),
        },
        oldDoc: { _trustedEditor: 'active', recipient: `${grant.recipient.kind}:${grant.recipient.id.toString()}`, scope: grant.scope },
        newDoc: { _trustedEditor: 'revoked', recipient: `${grant.recipient.kind}:${grant.recipient.id.toString()}`, scope: grant.scope },
        approvalSource: 'claimant-approved',
        approvalContext: {
          trustedEditorId: grant._id.toString(),
          action: 'revoke',
        },
      })
    }

    // Notify the former trusted editor (if it's a user — for unit recipients
    // notify the recipient unit's claimant)
    let notifyRecipientId: Types.ObjectId | null = null
    if (grant.recipient.kind === 'User') {
      notifyRecipientId = grant.recipient.id
    } else {
      const recipientUnit = await fetchUnit(grant.recipient.kind as 'Venue' | 'ProductionCompany' | 'Person', grant.recipient.id)
      notifyRecipientId = recipientUnit?.claimedBy ?? null
    }
    if (notifyRecipientId) {
      await createNotification({
        recipient: notifyRecipientId,
        kind: 'trust_revoked',
        context: {
          trustedEditorId: grant._id.toString(),
          grantedOnKind: grant.grantedOn.kind,
          grantedOnName: grantingUnit?.name ?? null,
          grantedOnSlug: grantingUnit?.slug ?? null,
        },
      })
    }

    return { trustedEditor: grant }
  },
})
