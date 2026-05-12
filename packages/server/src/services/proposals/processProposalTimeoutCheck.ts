import { Types } from 'mongoose'
import { ProposalModel } from '../../entities/proposal/proposalModel'
import { NotificationModel } from '../../entities/notification/notificationModel'
import { PerformanceModel } from '../../entities/performance/performanceModel'
import { VenueModel } from '../../entities/venue/venueModel'
import { ProductionCompanyModel } from '../../entities/productionCompany/productionCompanyModel'
import { RunModel } from '../../entities/run/runModel'
import { applyProposalDiff } from '../../entities/proposal/mutations/approveProposal'
import { createNotification } from '../notifications/createNotification'

// Phase 4 — proposal timeout cron. Daily run. Two effects:
//
//   1. Day-10 warning: joint proposals with one approval older than 10 days and
//      no warning yet → fire `proposal_timeout_warning` to the silent claimant.
//   2. Day-14 auto-approve: joint proposals with one approval older than 14
//      days and no decline → apply the diff with `approvalSource: 'timeout-
//      approved'`, fire `proposal_timeout_auto_approved` to both claimants
//      and the proposer.
//
// Warning de-dup uses the existence of a prior `proposal_timeout_warning`
// notification keyed by proposalId — same pattern as the claim-expire cron.

const ONE_DAY_MS = 24 * 60 * 60 * 1000
const WARN_THRESHOLD_DAYS = 10
const AUTO_APPROVE_THRESHOLD_DAYS = 14

interface ProcessResult {
  warningsSent: number
  autoApproved: number
  errors: number
}

async function findSilentClaimantId(proposal: any): Promise<{
  silentClaimantId: string | null
  bothClaimants: string[]
}> {
  const perf = await PerformanceModel.findById(proposal.target.id).select('run venueId').lean()
  if (!perf) return { silentClaimantId: null, bothClaimants: [] }
  const run = await RunModel.findById(perf.run).select('productionCompany').lean()
  const [v, c] = await Promise.all([
    VenueModel.findById(perf.venueId).select('claimedBy').lean(),
    run?.productionCompany
      ? ProductionCompanyModel.findById(run.productionCompany).select('claimedBy').lean()
      : Promise.resolve(null),
  ])
  const venueClaimantId = v?.claimedBy?.toString() ?? null
  const companyClaimantId = c?.claimedBy?.toString() ?? null

  const bothClaimants = Array.from(new Set([venueClaimantId, companyClaimantId].filter(Boolean) as string[]))

  const hasVenueApproval = proposal.approvals.some((a: any) => a.role === 'venue-claimant')
  const hasCompanyApproval = proposal.approvals.some((a: any) => a.role === 'company-claimant')

  if (!hasVenueApproval && venueClaimantId) return { silentClaimantId: venueClaimantId, bothClaimants }
  if (!hasCompanyApproval && companyClaimantId) return { silentClaimantId: companyClaimantId, bothClaimants }
  return { silentClaimantId: null, bothClaimants }
}

export async function processProposalTimeoutCheck(): Promise<ProcessResult> {
  const now = Date.now()
  const warnThreshold = new Date(now - WARN_THRESHOLD_DAYS * ONE_DAY_MS)
  const autoApproveThreshold = new Date(now - AUTO_APPROVE_THRESHOLD_DAYS * ONE_DAY_MS)

  let warningsSent = 0
  let autoApproved = 0
  let errors = 0

  // 1) Day-14 auto-approve pass.
  const autoCandidates = await ProposalModel.find({
    status: 'pending',
    isJointStewardship: true,
    firstApprovalAt: { $ne: null, $lt: autoApproveThreshold },
  })

  for (const proposal of autoCandidates) {
    // Sanity: must have at least one approval and not have a second on the
    // other side already (if so it'd be approved, but guard anyway).
    if (proposal.approvals.length < 1 || proposal.approvals.length >= 2) continue

    const applyResult = await applyProposalDiff(proposal, 'timeout-approved', {
      timeoutDays: AUTO_APPROVE_THRESHOLD_DAYS,
      silentRole: proposal.approvals[0].role === 'venue-claimant' ? 'company-claimant' : 'venue-claimant',
    })
    if (!applyResult.ok) {
      errors++
      continue
    }
    proposal.status = 'auto-approved'
    proposal.approvedAt = new Date()
    await proposal.save()

    const { bothClaimants } = await findSilentClaimantId(proposal)
    const recipients = new Set<string>(bothClaimants)
    if (proposal.proposer?.kind === 'User' && proposal.proposer.userId) {
      recipients.add(proposal.proposer.userId.toString())
    }
    for (const recipient of recipients) {
      await createNotification({
        recipient,
        kind: 'proposal_timeout_auto_approved',
        context: {
          proposalId: proposal._id.toString(),
          targetKind: proposal.target.kind,
          targetId: (proposal.target.id as Types.ObjectId).toString(),
        },
      })
    }
    autoApproved++
  }

  // 2) Day-10 warning pass. Skip ones already auto-approved above.
  const warnCandidates = await ProposalModel.find({
    status: 'pending',
    isJointStewardship: true,
    firstApprovalAt: { $ne: null, $lt: warnThreshold },
  })

  for (const proposal of warnCandidates) {
    if (proposal.approvals.length !== 1) continue

    const { silentClaimantId } = await findSilentClaimantId(proposal)
    if (!silentClaimantId) continue

    const existingWarning = await NotificationModel.findOne({
      recipient: silentClaimantId,
      kind: 'proposal_timeout_warning',
      'context.proposalId': proposal._id.toString(),
    }).lean()
    if (existingWarning) continue

    await createNotification({
      recipient: silentClaimantId,
      kind: 'proposal_timeout_warning',
      context: {
        proposalId: proposal._id.toString(),
        targetKind: proposal.target.kind,
        targetId: (proposal.target.id as Types.ObjectId).toString(),
        daysSilent: Math.floor((now - (proposal.firstApprovalAt?.getTime() ?? now)) / ONE_DAY_MS),
      },
    })
    warningsSent++
  }

  return { warningsSent, autoApproved, errors }
}
