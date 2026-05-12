import { GraphQLList, GraphQLNonNull, GraphQLString } from 'graphql'
import { mutationWithClientMutationId } from 'graphql-relay'
import { Types } from 'mongoose'
import { errorField } from '../../../graphql/errorField'
import { trustedEditorType } from '../trustedEditorTypes'
import {
  GrantedOnKind,
  RecipientKind,
  TrustedEditorModel,
  TrustedEditorRoleTemplate,
} from '../trustedEditorModel'
import { UserModel } from '../../user/userModel'
import { VenueModel } from '../../venue/venueModel'
import { ProductionCompanyModel } from '../../productionCompany/productionCompanyModel'
import { PersonModel } from '../../person/personModel'
import { createNotification } from '../../../services/notifications/createNotification'
import {
  ActionId,
  ALL_ACTION_IDS,
  ACTION_CATALOG,
  ROLE_TEMPLATES,
  RoleTemplateId,
} from '../../../permissions/actionCatalog'

const GRANTED_ON_KINDS: GrantedOnKind[] = ['Venue', 'ProductionCompany', 'Person']
const RECIPIENT_KINDS: RecipientKind[] = ['User', 'Venue', 'ProductionCompany', 'Person']
const ROLE_TEMPLATE_IDS: TrustedEditorRoleTemplate[] = ['Manager', 'Booker', 'Publicist', 'Personal', 'Custom']

// Resolve the role template's action set, optionally clipped to the granting
// unit's target type (Manager === ALL_ACTION_IDS but we don't restrict by kind;
// the action catalog's targetType gate already prevents misuse downstream).
function defaultScopeFromTemplate(template: TrustedEditorRoleTemplate): ActionId[] {
  if (template === 'Custom') return []
  return ROLE_TEMPLATES[template as RoleTemplateId] ?? []
}

async function fetchUnit(kind: GrantedOnKind, id: string | Types.ObjectId): Promise<any> {
  if (kind === 'Venue') return VenueModel.findById(id)
  if (kind === 'ProductionCompany') return ProductionCompanyModel.findById(id)
  if (kind === 'Person') return PersonModel.findById(id)
  return null
}

// Phase 5 — createTrustedEditor. Called from the proposal-approve-with-toggle
// path on the frontend, and from the trust dashboard. Validates the caller is
// admin OR claimant of the granting unit, and that the granted scope is a
// subset of valid action ids. Fires `trust_granted` and (when recipient is a
// unit) `reciprocity_offered`.
export const createTrustedEditor = mutationWithClientMutationId({
  name: 'createTrustedEditor',
  description: 'Promote a recipient (user or unit) to trusted editor on a unit you claim. Auto-publishes their future edits within the granted scope.',
  inputFields: {
    grantedOnKind: { type: new GraphQLNonNull(GraphQLString), description: 'Venue | ProductionCompany | Person' },
    grantedOnId: { type: new GraphQLNonNull(GraphQLString) },
    recipientKind: { type: new GraphQLNonNull(GraphQLString), description: 'User | Venue | ProductionCompany | Person' },
    recipientId: { type: new GraphQLNonNull(GraphQLString) },
    roleTemplate: { type: new GraphQLNonNull(GraphQLString), description: 'Manager | Booker | Publicist | Personal | Custom' },
    scope: {
      type: new GraphQLList(new GraphQLNonNull(GraphQLString)),
      description: 'Optional explicit list of ActionId strings. If omitted, uses the role template default.',
    },
  },
  outputFields: {
    trustedEditor: { type: trustedEditorType, resolve: (r: any) => r.trustedEditor },
    ...errorField,
  },
  mutateAndGetPayload: async (input, ctx) => {
    if (!ctx.user) return { error: 'Authentication required' }

    const { grantedOnKind, grantedOnId, recipientKind, recipientId, roleTemplate, scope } = input as {
      grantedOnKind: string
      grantedOnId: string
      recipientKind: string
      recipientId: string
      roleTemplate: string
      scope?: string[]
    }

    if (!GRANTED_ON_KINDS.includes(grantedOnKind as GrantedOnKind)) {
      return { error: `Invalid grantedOnKind. Must be one of: ${GRANTED_ON_KINDS.join(', ')}` }
    }
    if (!RECIPIENT_KINDS.includes(recipientKind as RecipientKind)) {
      return { error: `Invalid recipientKind. Must be one of: ${RECIPIENT_KINDS.join(', ')}` }
    }
    if (!ROLE_TEMPLATE_IDS.includes(roleTemplate as TrustedEditorRoleTemplate)) {
      return { error: `Invalid roleTemplate. Must be one of: ${ROLE_TEMPLATE_IDS.join(', ')}` }
    }

    // Validate caller is admin or claimant of the granting unit
    const callerUser = await UserModel.findById(ctx.user.id).select('isAdmin').lean()
    const isAdmin = !!callerUser?.isAdmin

    const grantingUnit = await fetchUnit(grantedOnKind as GrantedOnKind, grantedOnId)
    if (!grantingUnit) return { error: `${grantedOnKind} not found` }
    if (!isAdmin) {
      if (!grantingUnit.claimedBy || grantingUnit.claimedBy.toString() !== ctx.user.id) {
        return { error: 'Only the claimant of this unit can grant trust on it.' }
      }
    }

    // Validate recipient exists
    if (recipientKind === 'User') {
      const recipient = await UserModel.findById(recipientId).select('_id').lean()
      if (!recipient) return { error: 'Recipient user not found' }
      if (recipientId === ctx.user.id) {
        return { error: "You can't grant trust to yourself." }
      }
    } else {
      const recipientUnit = await fetchUnit(recipientKind as GrantedOnKind, recipientId)
      if (!recipientUnit) return { error: `Recipient ${recipientKind} not found` }
      // Forbid granting trust on a unit to itself
      if (recipientKind === grantedOnKind && recipientId === grantedOnId) {
        return { error: "You can't grant a unit trust on itself." }
      }
    }

    // Resolve scope. If caller passed an explicit array, validate every entry
    // is a known ActionId; otherwise expand the template default.
    let resolvedScope: ActionId[]
    if (Array.isArray(scope) && scope.length > 0) {
      const invalid = scope.filter(s => !(s in ACTION_CATALOG))
      if (invalid.length > 0) {
        return { error: `Unknown actions in scope: ${invalid.join(', ')}` }
      }
      resolvedScope = scope as ActionId[]
    } else {
      resolvedScope = defaultScopeFromTemplate(roleTemplate as TrustedEditorRoleTemplate)
      if (resolvedScope.length === 0 && roleTemplate !== 'Custom') {
        // Defensive: shouldn't happen given the template catalog
        return { error: 'Resolved scope is empty for this template' }
      }
    }

    // Idempotency-ish: reactivate any prior revoked grant for the same triple
    const existing = await TrustedEditorModel.findOne({
      'grantedOn.kind': grantedOnKind,
      'grantedOn.id': new Types.ObjectId(grantedOnId),
      'recipient.kind': recipientKind,
      'recipient.id': new Types.ObjectId(recipientId),
      revokedAt: null,
    })
    if (existing) {
      return { error: 'An active trust grant already exists for this recipient on this unit.' }
    }

    const created = await new TrustedEditorModel({
      grantedOn: { kind: grantedOnKind, id: new Types.ObjectId(grantedOnId) },
      recipient: { kind: recipientKind, id: new Types.ObjectId(recipientId) },
      scope: resolvedScope,
      roleTemplate,
      grantedBy: new Types.ObjectId(ctx.user.id),
      grantedAt: new Date(),
    }).save()

    // Notify recipient — for a User recipient, send directly. For a unit
    // recipient, notify the recipient unit's claimant (if any) and also fire
    // the `reciprocity_offered` ping so they can add the reverse grant.
    if (recipientKind === 'User') {
      await createNotification({
        recipient: new Types.ObjectId(recipientId),
        kind: 'trust_granted',
        context: {
          trustedEditorId: created._id.toString(),
          grantedOnKind,
          grantedOnId,
          grantedOnName: grantingUnit.name ?? null,
          grantedOnSlug: grantingUnit.slug ?? null,
          roleTemplate,
          scope: resolvedScope,
        },
      })
    } else {
      const recipientUnit = await fetchUnit(recipientKind as GrantedOnKind, recipientId)
      const recipientClaimantId = recipientUnit?.claimedBy
      if (recipientClaimantId) {
        await createNotification({
          recipient: recipientClaimantId,
          kind: 'trust_granted',
          context: {
            trustedEditorId: created._id.toString(),
            grantedOnKind,
            grantedOnId,
            grantedOnName: grantingUnit.name ?? null,
            grantedOnSlug: grantingUnit.slug ?? null,
            recipientKind,
            recipientName: recipientUnit?.name ?? null,
            recipientSlug: recipientUnit?.slug ?? null,
            roleTemplate,
            scope: resolvedScope,
          },
        })
        await createNotification({
          recipient: recipientClaimantId,
          kind: 'reciprocity_offered',
          context: {
            trustedEditorId: created._id.toString(),
            grantedOnKind,
            grantedOnId,
            grantedOnName: grantingUnit.name ?? null,
            grantedOnSlug: grantingUnit.slug ?? null,
            recipientKind,
            recipientId,
            recipientName: recipientUnit?.name ?? null,
            recipientSlug: recipientUnit?.slug ?? null,
          },
        })
      }
    }

    return { trustedEditor: created }
  },
})

// Convenience helper used by the auto-approve-future flow on the frontend.
// Exported so tests can re-use the validation logic directly.
export { defaultScopeFromTemplate }
