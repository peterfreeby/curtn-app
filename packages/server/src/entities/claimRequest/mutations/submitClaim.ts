import { GraphQLNonNull, GraphQLString } from 'graphql'
import { mutationWithClientMutationId } from 'graphql-relay'
import { errorField } from '../../../graphql/errorField'
import { claimRequestType } from '../claimRequestTypes'
import { ClaimRequestModel, ClaimTargetKind } from '../claimRequestModel'
import { VenueModel } from '../../venue/venueModel'
import { ProductionCompanyModel } from '../../productionCompany/productionCompanyModel'
import { PersonModel } from '../../person/personModel'
import { UserModel } from '../../user/userModel'
import { computeTrustGraphEndorsements } from '../../../services/verificationSignals/computeTrustGraphEndorsements'
import { maybeAutoPromote } from '../../../services/verificationSignals/maybeAutoPromote'
import { createNotification } from '../../../services/notifications/createNotification'
import { SIGNAL_POINTS } from '../../../permissions/verificationSignals'

const TARGET_KINDS: ClaimTargetKind[] = ['venue', 'productionCompany', 'person']

// Polymorphic claim submission for the Claim & Edit Authority Model (Phase 2).
// Handles all three claimable target types (Venue, ProductionCompany, Person).
// On submission, the target unit transitions to `provisionally-claimed`.

export const submitClaim = mutationWithClientMutationId({
  name: 'submitClaim',
  description: 'Submit a claim request on a Venue, ProductionCompany, or Person. Transitions the unit to provisionally-claimed pending admin approval.',
  inputFields: {
    targetKind: {
      type: new GraphQLNonNull(GraphQLString),
      description: 'One of: venue | productionCompany | person'
    },
    targetId: {
      type: new GraphQLNonNull(GraphQLString),
      description: 'MongoDB ObjectId of the target unit'
    },
    evidence: {
      type: new GraphQLNonNull(GraphQLString),
      description: 'Open-text explanation of why the user is the right person to claim this unit'
    }
  },
  outputFields: {
    claimRequest: {
      type: claimRequestType,
      resolve: (response: any) => response.claimRequest
    },
    ...errorField
  },
  mutateAndGetPayload: async (input, ctx) => {
    if (!ctx.user) return { error: 'Authentication required' }

    const { targetKind, targetId, evidence } = input as { targetKind: string, targetId: string, evidence: string }

    if (!TARGET_KINDS.includes(targetKind as ClaimTargetKind)) {
      return { error: `Invalid targetKind. Must be one of: ${TARGET_KINDS.join(', ')}` }
    }
    if (!evidence || evidence.trim().length === 0) {
      return { error: 'Evidence is required — tell us why you should be the steward of this unit.' }
    }

    const user = await UserModel.findById(ctx.user.id)
    if (!user) return { error: 'User not found' }

    // Resolve the target unit
    const unit = await fetchUnit(targetKind as ClaimTargetKind, targetId)
    if (!unit) return { error: `${targetKind} not found` }

    // Block if already claimed (passive or synced)
    if (unit.claimState === 'claimed-passive' || unit.claimState === 'claimed-synced') {
      return { error: 'This unit has already been claimed. To take over, the current claimant must transfer or you can contact admin.' }
    }

    // Block if user already has a pending claim on this exact target
    const existing = await ClaimRequestModel.findOne({
      user: user._id,
      status: 'pending',
      'target.kind': targetKind,
      'target.id': unit._id,
    })
    if (existing) return { error: 'You already have a pending claim request on this unit.' }

    // Compute trust-graph endorsements at submission time. (Phase 8 — refreshed
    // periodically by /api/cron/refresh-trust-graph-signals.)
    const endorsements = await computeTrustGraphEndorsements(user._id)

    const claimRequest = await new ClaimRequestModel({
      user: user._id,
      target: { kind: targetKind, id: unit._id },
      message: evidence.trim(),
      signals: {
        webmasterVerified: false,
        externalProfileLinks: [],
        trustGraphEndorsements: endorsements,
        autoPromotionScore: 0,
      },
    }).save()

    // Transition unit → provisionally-claimed (don't overwrite if already provisional from another user)
    if (unit.claimState === 'unclaimed') {
      unit.claimState = 'provisionally-claimed'
      await unit.save()
    }

    // Phase 8 — try auto-promotion. If signals already meet the threshold at
    // submission (e.g. user has trust-graph + prior claim), the claim moves
    // straight to `approved` and the unit to `claimed-passive`.
    const result = await maybeAutoPromote(claimRequest)

    // If not auto-promoted, fire a `claim_signals_insufficient` informational
    // notification so the claimant knows the claim is queued for admin.
    if (!result.promoted && result.score < SIGNAL_POINTS.AUTO_PROMOTE_THRESHOLD) {
      await createNotification({
        recipient: user._id,
        kind: 'claim_signals_insufficient',
        context: {
          targetKind,
          targetId: unit._id.toString(),
          targetName: unit.name,
          targetSlug: unit.slug ?? null,
          score: result.score,
          threshold: SIGNAL_POINTS.AUTO_PROMOTE_THRESHOLD,
        },
      })
    }

    return { claimRequest }
  }
})

async function fetchUnit(kind: ClaimTargetKind, id: string): Promise<any> {
  if (kind === 'venue') return VenueModel.findById(id)
  if (kind === 'productionCompany') return ProductionCompanyModel.findById(id)
  if (kind === 'person') return PersonModel.findById(id)
  return null
}
