import { GraphQLNonNull, GraphQLString } from 'graphql'
import { mutationWithClientMutationId } from 'graphql-relay'
import { Types } from 'mongoose'
import { errorField } from '../../../graphql/errorField'
import { trustedEditorType } from '../trustedEditorTypes'
import { TrustedEditorModel, GrantedOnKind } from '../trustedEditorModel'
import { UserModel } from '../../user/userModel'
import { VenueModel } from '../../venue/venueModel'
import { ProductionCompanyModel } from '../../productionCompany/productionCompanyModel'
import { PersonModel } from '../../person/personModel'
import { createNotification } from '../../../services/notifications/createNotification'
import { ROLE_TEMPLATES } from '../../../permissions/actionCatalog'

// Phase 5 — acceptReciprocity. Reads the original TrustedEditor (Atlantic grants
// Civilians) and creates the inverse grant (Civilians grants Atlantic) with the
// Manager role-template default. Caller must be the claimant of the original
// grant's recipient unit. Per scoping doc D4 — one-click flow from the
// reciprocity_offered notification.

async function fetchUnit(kind: GrantedOnKind, id: Types.ObjectId): Promise<any> {
  if (kind === 'Venue') return VenueModel.findById(id)
  if (kind === 'ProductionCompany') return ProductionCompanyModel.findById(id)
  if (kind === 'Person') return PersonModel.findById(id)
  return null
}

export const acceptReciprocity = mutationWithClientMutationId({
  name: 'acceptReciprocity',
  description: 'One-click accept of a reciprocity offer — creates the reverse trust grant with the Manager template.',
  inputFields: {
    originalTrustedEditorId: { type: new GraphQLNonNull(GraphQLString) },
  },
  outputFields: {
    trustedEditor: { type: trustedEditorType, resolve: (r: any) => r.trustedEditor },
    ...errorField,
  },
  mutateAndGetPayload: async (input, ctx) => {
    if (!ctx.user) return { error: 'Authentication required' }

    const { originalTrustedEditorId } = input as { originalTrustedEditorId: string }

    const original = await TrustedEditorModel.findById(originalTrustedEditorId)
    if (!original) return { error: 'Original trust grant not found' }
    if (original.recipient.kind === 'User') {
      return { error: 'Reciprocity only applies to unit-to-unit grants.' }
    }

    // The reverse direction: original.recipient (unit) grants on original.grantedOn (unit).
    const reverseGrantedOnKind = original.recipient.kind as GrantedOnKind
    const reverseGrantedOnId = original.recipient.id
    const reverseRecipientKind = original.grantedOn.kind
    const reverseRecipientId = original.grantedOn.id

    // Caller must be claimant of the unit doing the new granting (i.e., the
    // original recipient unit).
    const reverseGrantingUnit = await fetchUnit(reverseGrantedOnKind, reverseGrantedOnId)
    if (!reverseGrantingUnit) return { error: 'Recipient unit not found' }
    if (!reverseGrantingUnit.claimedBy || reverseGrantingUnit.claimedBy.toString() !== ctx.user.id) {
      return { error: 'Only the claimant of the recipient unit can accept this reciprocity offer.' }
    }

    // Avoid duplicates
    const existing = await TrustedEditorModel.findOne({
      'grantedOn.kind': reverseGrantedOnKind,
      'grantedOn.id': reverseGrantedOnId,
      'recipient.kind': reverseRecipientKind,
      'recipient.id': reverseRecipientId,
      revokedAt: null,
    })
    if (existing) {
      return { error: 'A reverse trust grant already exists.' }
    }

    const scope = ROLE_TEMPLATES.Manager
    const created = await new TrustedEditorModel({
      grantedOn: { kind: reverseGrantedOnKind, id: reverseGrantedOnId },
      recipient: { kind: reverseRecipientKind, id: reverseRecipientId },
      scope,
      roleTemplate: 'Manager',
      grantedBy: new Types.ObjectId(ctx.user.id),
      grantedAt: new Date(),
    }).save()

    // Notify the claimant of the unit now receiving the reverse grant (the
    // original granter).
    const originalGrantingUnit = await fetchUnit(original.grantedOn.kind, original.grantedOn.id)
    if (originalGrantingUnit?.claimedBy) {
      await createNotification({
        recipient: originalGrantingUnit.claimedBy,
        kind: 'trust_granted',
        context: {
          trustedEditorId: created._id.toString(),
          grantedOnKind: reverseGrantedOnKind,
          grantedOnId: reverseGrantedOnId.toString(),
          grantedOnName: reverseGrantingUnit.name ?? null,
          grantedOnSlug: reverseGrantingUnit.slug ?? null,
          recipientKind: reverseRecipientKind,
          recipientName: originalGrantingUnit.name ?? null,
          recipientSlug: originalGrantingUnit.slug ?? null,
          roleTemplate: 'Manager',
          scope,
          viaReciprocity: true,
        },
      })
    }

    return { trustedEditor: created }
  },
})
