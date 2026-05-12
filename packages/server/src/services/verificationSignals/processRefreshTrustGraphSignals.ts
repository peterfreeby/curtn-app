import { ClaimRequestModel } from '../../entities/claimRequest/claimRequestModel'
import { computeTrustGraphEndorsements } from './computeTrustGraphEndorsements'
import { maybeAutoPromote } from './maybeAutoPromote'

// Phase 8 — Daily cron job. For each pending ClaimRequest, recompute the
// trust-graph endorsements (new TrustedEditor grants may have landed since
// submission). If the refreshed score now meets threshold, auto-promote.

export async function processRefreshTrustGraphSignals() {
  const pending = await ClaimRequestModel.find({ status: 'pending' })
  let refreshed = 0
  let promoted = 0
  for (const claim of pending) {
    const endorsements = await computeTrustGraphEndorsements(claim.user)
    if (!claim.signals) (claim as any).signals = {}
    claim.signals.trustGraphEndorsements = endorsements as any
    await claim.save()
    refreshed++
    const result = await maybeAutoPromote(claim)
    if (result.promoted) promoted++
  }
  return { refreshed, promoted }
}
