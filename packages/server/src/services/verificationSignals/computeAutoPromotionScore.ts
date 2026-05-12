import { SIGNAL_POINTS } from '../../permissions/verificationSignals'
import { ClaimRequestModel, IClaimRequest } from '../../entities/claimRequest/claimRequestModel'
import { Types } from 'mongoose'

// Phase 8 — Sum all available signals on a ClaimRequest, capped per-class.
// Returns the integer score. Above SIGNAL_POINTS.AUTO_PROMOTE_THRESHOLD →
// auto-approve.
//
// Evidence text quality is a tiny rule-based scorer (length + presence of
// identifying phrases). Not LLM-based; intentionally simple and predictable.

export interface ScoreBreakdown {
  webmasterVerified: number
  externalProfiles: number
  trustGraph: number
  priorApprovedClaim: number
  evidenceTextQuality: number
  sameEmailDomain: number // always 0 in v1, kept for parity with design doc
  total: number
  details: string[]
}

function scoreEvidenceText(text?: string): number {
  if (!text) return 0
  const trimmed = text.trim()
  let score = 0
  // Length signal: at least a sentence → 5pts; substantive → up to 10pts.
  if (trimmed.length >= 40) score += 5
  if (trimmed.length >= 200) score += 5
  // Mentions of role-bearing words gives a small bump.
  const roleSignals = /\b(owner|founder|director|manager|booker|producer|artistic|publicist|press|admin)\b/i
  if (roleSignals.test(trimmed)) score += 5
  return Math.min(score, SIGNAL_POINTS.EVIDENCE_TEXT_QUALITY_MAX)
}

async function priorApprovedClaim(userId: Types.ObjectId | string): Promise<boolean> {
  const count = await ClaimRequestModel.countDocuments({
    user: userId,
    status: 'approved',
  })
  return count > 0
}

export async function computeAutoPromotionScore(
  claimRequest: IClaimRequest & { _id?: any }
): Promise<ScoreBreakdown> {
  const details: string[] = []

  const signals = claimRequest.signals || ({} as any)

  // Webmaster verification — single signal worth 100 alone.
  const webmasterVerified = signals.webmasterVerified
    ? SIGNAL_POINTS.WEBMASTER_VERIFIED
    : 0
  if (webmasterVerified) details.push('webmaster')

  // External profile links: each verified link contributes, capped at the
  // class cap. `verifiedAt` is set when the link is recorded — we don't
  // require it explicitly here since structural validation happened at
  // linkExternalProfile time, but treat undefined verifiedAt as "not counted".
  const links: any[] = Array.isArray(signals.externalProfileLinks)
    ? signals.externalProfileLinks
    : []
  const linkedCount = links.filter((l) => l && l.verifiedAt).length
  const externalProfiles = Math.min(
    linkedCount * SIGNAL_POINTS.EXTERNAL_PROFILE_LINKED,
    SIGNAL_POINTS.EXTERNAL_PROFILE_LINKED_CAP
  )
  if (externalProfiles > 0) details.push(`profiles×${linkedCount}`)

  // Trust-graph endorsements: each grant contributes, capped at class cap.
  const endorsements: any[] = Array.isArray(signals.trustGraphEndorsements)
    ? signals.trustGraphEndorsements
    : []
  const trustGraph = Math.min(
    endorsements.length * SIGNAL_POINTS.TRUST_GRAPH_ENDORSEMENT,
    SIGNAL_POINTS.TRUST_GRAPH_ENDORSEMENT_CAP
  )
  if (trustGraph > 0) details.push(`trusted-by×${endorsements.length}`)

  // Prior approved claim by this user (one-time signal).
  const hasPrior = await priorApprovedClaim(claimRequest.user)
  const priorApprovedClaimPts = hasPrior ? SIGNAL_POINTS.PRIOR_APPROVED_CLAIM : 0
  if (priorApprovedClaimPts) details.push('prior-claim')

  // Evidence text quality (heuristic).
  const evidenceTextQuality = scoreEvidenceText(claimRequest.message)
  if (evidenceTextQuality > 0) details.push(`evidence:${evidenceTextQuality}`)

  // SAME_EMAIL_DOMAIN_AS_WEBSITE — uncomputable in Curtn v1 (no email).
  const sameEmailDomain = SIGNAL_POINTS.SAME_EMAIL_DOMAIN_AS_WEBSITE // = 0

  const total =
    webmasterVerified +
    externalProfiles +
    trustGraph +
    priorApprovedClaimPts +
    evidenceTextQuality +
    sameEmailDomain

  return {
    webmasterVerified,
    externalProfiles,
    trustGraph,
    priorApprovedClaim: priorApprovedClaimPts,
    evidenceTextQuality,
    sameEmailDomain,
    total,
    details,
  }
}
