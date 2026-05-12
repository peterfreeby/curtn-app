import { GraphQLNonNull, GraphQLString } from 'graphql'
import { mutationWithClientMutationId } from 'graphql-relay'
import { errorField } from '../../../graphql/errorField'
import { claimRequestType } from '../claimRequestTypes'
import { ClaimRequestModel, ExternalProfilePlatform } from '../claimRequestModel'
import { validateExternalProfile, detectPlatform } from '../../../services/verificationSignals/externalProfileValidator'
import { maybeAutoPromote } from '../../../services/verificationSignals/maybeAutoPromote'

// Phase 8 — Records a link to an external profile (IMDb Pro, Wikidata,
// Wikipedia, Spotify Artist). Validates URL structure. For Wikidata Person
// targets, cross-checks the Q-number's name against the claimed person.

const VALID_PLATFORMS: ExternalProfilePlatform[] = ['imdb-pro', 'wikidata', 'spotify-artist', 'wikipedia', 'other']

export const linkExternalProfileMutation = mutationWithClientMutationId({
  name: 'linkExternalProfile',
  description: 'Attach a verified external-profile URL (IMDb Pro, Wikidata, etc.) to a pending claim.',
  inputFields: {
    claimRequestId: { type: new GraphQLNonNull(GraphQLString) },
    url: { type: new GraphQLNonNull(GraphQLString) },
    platform: { type: GraphQLString, description: 'Optional platform hint; auto-detected if omitted.' },
  },
  outputFields: {
    claimRequest: { type: claimRequestType, resolve: (r: any) => r.claimRequest },
    autoPromoted: {
      type: GraphQLString,
      resolve: (r: any) => r.autoPromoted ? 'true' : 'false',
    },
    ...errorField,
  },
  mutateAndGetPayload: async (input, ctx) => {
    if (!ctx.user) return { error: 'Authentication required' }
    const { claimRequestId, url, platform } = input as {
      claimRequestId: string
      url: string
      platform?: string
    }

    const claim = await ClaimRequestModel.findById(claimRequestId)
    if (!claim) return { error: 'Claim request not found' }
    if (claim.user.toString() !== ctx.user.id.toString()) {
      return { error: 'You can only link profiles to your own claim' }
    }
    if (claim.status !== 'pending') {
      return { error: `Claim is already ${claim.status}` }
    }

    const declared = platform as ExternalProfilePlatform | undefined
    if (declared && !VALID_PLATFORMS.includes(declared)) {
      return { error: `Invalid platform. Must be one of: ${VALID_PLATFORMS.join(', ')}` }
    }

    const validation = await validateExternalProfile(claim, url, declared)
    if (!validation.ok) {
      return { error: validation.error ?? 'URL did not validate', claimRequest: claim }
    }

    if (!claim.signals) {
      ;(claim as any).signals = {}
    }
    if (!Array.isArray(claim.signals.externalProfileLinks)) {
      claim.signals.externalProfileLinks = []
    }
    // De-dupe on URL (claimant could submit the same link twice).
    if (claim.signals.externalProfileLinks.some((l: any) => l.url === url)) {
      return { error: 'That profile is already linked', claimRequest: claim }
    }
    const resolvedPlatform = validation.platform ?? detectPlatform(url) ?? 'other'
    claim.signals.externalProfileLinks.push({
      url,
      platform: resolvedPlatform,
      verifiedAt: new Date(),
    })
    await claim.save()

    // Recompute / maybe auto-promote.
    const promo = await maybeAutoPromote(claim)

    return { claimRequest: claim, autoPromoted: promo.promoted }
  },
})
