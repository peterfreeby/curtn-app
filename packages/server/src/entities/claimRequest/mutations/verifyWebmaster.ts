import { GraphQLNonNull, GraphQLString } from 'graphql'
import { mutationWithClientMutationId } from 'graphql-relay'
import { errorField } from '../../../graphql/errorField'
import { claimRequestType } from '../claimRequestTypes'
import { ClaimRequestModel } from '../claimRequestModel'
import { verifyWebmasterToken, getWebsiteForClaim } from '../../../services/verificationSignals/webmasterVerification'
import { maybeAutoPromote } from '../../../services/verificationSignals/maybeAutoPromote'
import { createNotification } from '../../../services/notifications/createNotification'

// Phase 8 — Attempts to verify the meta tag or TXT record. On success the
// claim's `signals.webmasterVerified` flips to true (100 pts → guaranteed
// auto-promotion) and maybeAutoPromote runs. Either path fires a
// notification (succeeded / failed).

export const verifyWebmasterMutation = mutationWithClientMutationId({
  name: 'verifyWebmaster',
  description: 'Fetch the unit website and check for the issued curtn-verify token (meta tag or DNS TXT).',
  inputFields: {
    claimRequestId: { type: new GraphQLNonNull(GraphQLString) },
  },
  outputFields: {
    claimRequest: { type: claimRequestType, resolve: (r: any) => r.claimRequest },
    verified: { type: GraphQLString, resolve: (r: any) => r.verified ? 'true' : 'false' },
    method: { type: GraphQLString, resolve: (r: any) => r.method ?? null },
    autoPromoted: {
      type: GraphQLString,
      resolve: (r: any) => r.autoPromoted ? 'true' : 'false',
    },
    ...errorField,
  },
  mutateAndGetPayload: async (input, ctx) => {
    if (!ctx.user) return { error: 'Authentication required' }
    const { claimRequestId } = input as { claimRequestId: string }

    const claim = await ClaimRequestModel.findById(claimRequestId)
    if (!claim) return { error: 'Claim request not found' }
    if (claim.user.toString() !== ctx.user.id.toString()) {
      return { error: 'You can only verify your own claim' }
    }
    if (claim.status !== 'pending') {
      return { error: `Claim is already ${claim.status}` }
    }

    const token = claim.signals?.webmasterToken
    if (!token) {
      return { error: 'No webmaster token issued. Generate one first.' }
    }
    const expires = claim.signals?.webmasterTokenExpires
    if (expires && expires.getTime() < Date.now()) {
      return { error: 'Webmaster token expired. Generate a new one.' }
    }

    const website = await getWebsiteForClaim(claim)
    if (!website) return { error: 'No website recorded on this unit.' }

    const result = await verifyWebmasterToken(website, token)
    if (!result.verified) {
      claim.signals.webmasterVerified = false
      await claim.save()
      await createNotification({
        recipient: claim.user,
        kind: 'webmaster_verification_failed',
        context: {
          claimRequestId: claim._id.toString(),
          website,
          reason: result.error ?? 'unknown',
        },
      })
      return { claimRequest: claim, verified: false, error: result.error }
    }

    claim.signals.webmasterVerified = true
    await claim.save()
    await createNotification({
      recipient: claim.user,
      kind: 'webmaster_verification_succeeded',
      context: {
        claimRequestId: claim._id.toString(),
        website,
        method: result.method,
      },
    })

    // Webmaster verified == 100pts, sufficient alone → trigger promotion.
    const promo = await maybeAutoPromote(claim)

    return {
      claimRequest: claim,
      verified: true,
      method: result.method,
      autoPromoted: promo.promoted,
    }
  },
})
