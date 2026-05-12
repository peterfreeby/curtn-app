import { GraphQLNonNull, GraphQLString } from 'graphql'
import { mutationWithClientMutationId } from 'graphql-relay'
import { errorField } from '../../../graphql/errorField'
import { claimRequestType } from '../claimRequestTypes'
import { ClaimRequestModel } from '../claimRequestModel'
import { generateWebmasterToken as generateToken, getWebsiteForClaim } from '../../../services/verificationSignals/webmasterVerification'

// Phase 8 — Issues a webmaster verification token for a pending claim.
// Owner (the claim submitter) only. The token lives 7 days. The frontend
// shows the claimant the meta tag + TXT record options after this fires.

export const generateWebmasterTokenMutation = mutationWithClientMutationId({
  name: 'generateWebmasterToken',
  description: 'Issue a per-claim webmaster verification token. Claimant uses it via meta tag or DNS TXT.',
  inputFields: {
    claimRequestId: {
      type: new GraphQLNonNull(GraphQLString),
      description: 'ObjectId of the ClaimRequest'
    },
  },
  outputFields: {
    claimRequest: {
      type: claimRequestType,
      resolve: (r: any) => r.claimRequest,
    },
    token: {
      type: GraphQLString,
      resolve: (r: any) => r.token ?? null,
    },
    website: {
      type: GraphQLString,
      resolve: (r: any) => r.website ?? null,
    },
    ...errorField,
  },
  mutateAndGetPayload: async (input, ctx) => {
    if (!ctx.user) return { error: 'Authentication required' }
    const { claimRequestId } = input as { claimRequestId: string }

    const claim = await ClaimRequestModel.findById(claimRequestId)
    if (!claim) return { error: 'Claim request not found' }
    if (claim.user.toString() !== ctx.user.id.toString()) {
      return { error: 'You can only issue tokens for your own claim' }
    }
    if (claim.status !== 'pending') {
      return { error: `Claim is already ${claim.status}` }
    }

    const website = await getWebsiteForClaim(claim)
    if (!website) {
      return { error: 'No website is recorded on this unit. Webmaster verification only works for units that have a website URL (currently venues only).' }
    }

    const { token, expiresAt } = generateToken()
    if (!claim.signals) {
      ;(claim as any).signals = {}
    }
    claim.signals.webmasterToken = token
    claim.signals.webmasterTokenExpires = expiresAt
    claim.signals.webmasterVerified = false
    await claim.save()

    return { claimRequest: claim, token, website }
  },
})
