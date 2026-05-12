import { GraphQLBoolean, GraphQLNonNull } from 'graphql'
import { mutationWithClientMutationId } from 'graphql-relay'
import { errorField } from '../../../graphql/errorField'
import { bumpAllForUser } from '../../../services/claims/bumpClaimantActivity'

// Touched by the claimant dashboard on mount. Bumps lastClaimantActivityAt on
// every unit the user claims, keeping claims alive against auto-expire (Task 17).

export const pingDashboardActivity = mutationWithClientMutationId({
  name: 'pingDashboardActivity',
  description: 'Bumps activity timestamp on all of the current user\'s claimed units.',
  inputFields: {},
  outputFields: {
    ok: {
      type: new GraphQLNonNull(GraphQLBoolean),
      resolve: (r: any) => r.ok ?? false
    },
    ...errorField,
  },
  mutateAndGetPayload: async (_input, ctx) => {
    if (!ctx.user) return { error: 'Unauthorized', ok: false }
    await bumpAllForUser(ctx.user.id)
    return { ok: true }
  }
})
