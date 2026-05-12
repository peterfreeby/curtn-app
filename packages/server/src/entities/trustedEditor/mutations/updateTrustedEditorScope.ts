import { GraphQLList, GraphQLNonNull, GraphQLString } from 'graphql'
import { mutationWithClientMutationId } from 'graphql-relay'
import { errorField } from '../../../graphql/errorField'
import { trustedEditorType } from '../trustedEditorTypes'
import { TrustedEditorModel } from '../trustedEditorModel'
import { UserModel } from '../../user/userModel'
import { ACTION_CATALOG, ActionId } from '../../../permissions/actionCatalog'

// Phase 5 — updateTrustedEditorScope. Claimant edits an existing grant's scope
// (and optionally its roleTemplate label) without revoking/re-creating. Caller
// must be admin or the grant's `grantedBy`.
export const updateTrustedEditorScope = mutationWithClientMutationId({
  name: 'updateTrustedEditorScope',
  description: 'Update the scope of an existing trusted-editor grant.',
  inputFields: {
    trustedEditorId: { type: new GraphQLNonNull(GraphQLString) },
    scope: { type: new GraphQLNonNull(new GraphQLList(new GraphQLNonNull(GraphQLString))) },
    roleTemplate: { type: GraphQLString, description: 'Optional: update the displayed role template label.' },
  },
  outputFields: {
    trustedEditor: { type: trustedEditorType, resolve: (r: any) => r.trustedEditor },
    ...errorField,
  },
  mutateAndGetPayload: async (input, ctx) => {
    if (!ctx.user) return { error: 'Authentication required' }

    const { trustedEditorId, scope, roleTemplate } = input as {
      trustedEditorId: string
      scope: string[]
      roleTemplate?: string
    }

    const grant = await TrustedEditorModel.findById(trustedEditorId)
    if (!grant) return { error: 'Trusted editor grant not found' }
    if (grant.revokedAt) return { error: 'This grant has been revoked.' }

    const adminUser = await UserModel.findById(ctx.user.id).select('isAdmin').lean()
    const isAdmin = !!adminUser?.isAdmin
    if (!isAdmin && grant.grantedBy.toString() !== ctx.user.id) {
      return { error: 'Only the grantor can update this scope.' }
    }

    const invalid = scope.filter(s => !(s in ACTION_CATALOG))
    if (invalid.length > 0) {
      return { error: `Unknown actions in scope: ${invalid.join(', ')}` }
    }

    grant.scope = scope as ActionId[]
    if (roleTemplate && ['Manager', 'Booker', 'Publicist', 'Personal', 'Custom'].includes(roleTemplate)) {
      grant.roleTemplate = roleTemplate as any
    }
    await grant.save()

    return { trustedEditor: grant }
  },
})
