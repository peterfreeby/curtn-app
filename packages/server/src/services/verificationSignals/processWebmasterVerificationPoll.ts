import { ClaimRequestModel } from '../../entities/claimRequest/claimRequestModel'
import { verifyWebmasterToken, getWebsiteForClaim } from './webmasterVerification'
import { maybeAutoPromote } from './maybeAutoPromote'
import { createNotification } from '../notifications/createNotification'

// Phase 8 — 15-min cron. Polls pending claims that issued a webmaster token
// but haven't verified yet. Abandons after the token expires (7 days).

export async function processWebmasterVerificationPoll() {
  const now = new Date()
  const candidates = await ClaimRequestModel.find({
    status: 'pending',
    'signals.webmasterToken': { $exists: true, $ne: null },
    'signals.webmasterVerified': false,
  })

  let checked = 0
  let verified = 0
  let promoted = 0
  let abandoned = 0

  for (const claim of candidates) {
    const expires = claim.signals?.webmasterTokenExpires
    if (expires && expires.getTime() < now.getTime()) {
      // Expired — clear the token so we stop polling.
      claim.signals.webmasterToken = undefined
      claim.signals.webmasterTokenExpires = undefined
      await claim.save()
      abandoned++
      await createNotification({
        recipient: claim.user,
        kind: 'webmaster_verification_failed',
        context: {
          claimRequestId: claim._id.toString(),
          reason: 'Token expired (7 days)',
        },
      })
      continue
    }
    const website = await getWebsiteForClaim(claim)
    if (!website || !claim.signals?.webmasterToken) continue
    checked++
    const result = await verifyWebmasterToken(website, claim.signals.webmasterToken)
    if (result.verified) {
      claim.signals.webmasterVerified = true
      await claim.save()
      verified++
      await createNotification({
        recipient: claim.user,
        kind: 'webmaster_verification_succeeded',
        context: {
          claimRequestId: claim._id.toString(),
          website,
          method: result.method,
        },
      })
      const promo = await maybeAutoPromote(claim)
      if (promo.promoted) promoted++
    }
  }

  return { checked, verified, promoted, abandoned }
}
