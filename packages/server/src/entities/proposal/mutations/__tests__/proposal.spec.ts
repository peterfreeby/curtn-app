import { Types } from 'mongoose'
import { UserModel } from '../../../user/userModel'
import { VenueModel } from '../../../venue/venueModel'
import { ProductionCompanyModel } from '../../../productionCompany/productionCompanyModel'
import { PersonModel } from '../../../person/personModel'
import { ShowModel } from '../../../show/showModel'
import { RunModel } from '../../../run/runModel'
import { PerformanceModel } from '../../../performance/performanceModel'
import { ProposalModel } from '../../proposalModel'
import { NotificationModel } from '../../../notification/notificationModel'
import { AuditLogModel } from '../../../auditLog/auditLogModel'
import { venueUpdate } from '../../../venue/mutations/venueUpdate'
import { performanceUpdate } from '../../../performance/mutations/performanceUpdate'
import { approveProposal } from '../approveProposal'
import { declineProposal } from '../declineProposal'
import { processProposalTimeoutCheck } from '../../../../services/proposals/processProposalTimeoutCheck'

// Phase 4 — proposal queue end-to-end. Drives mutations directly via
// .resolve(null, { input }, ctx, null), same pattern as Phase 3 tests.

async function callMutation(mutation: any, input: any, ctx: any) {
  return mutation.resolve(null, { input }, ctx, null)
}

describe('Proposal queue (Phase 4)', () => {
  let adminUser: any
  let claimantUser: any
  let venueClaimant: any
  let companyClaimant: any
  let proposerUser: any
  let secondProposerUser: any
  let outsiderUser: any

  beforeEach(async () => {
    await Promise.all([
      UserModel.deleteMany({}),
      VenueModel.deleteMany({}),
      ProductionCompanyModel.deleteMany({}),
      PersonModel.deleteMany({}),
      ShowModel.deleteMany({}),
      RunModel.deleteMany({}),
      PerformanceModel.deleteMany({}),
      ProposalModel.deleteMany({}),
      NotificationModel.deleteMany({}),
      AuditLogModel.deleteMany({}),
    ])

    adminUser = await new UserModel({ firebaseUid: 'a', phoneNumber: '+15550001001', username: 'admin', isAdmin: true }).save()
    claimantUser = await new UserModel({ firebaseUid: 'c', phoneNumber: '+15550001002', username: 'alice' }).save()
    venueClaimant = await new UserModel({ firebaseUid: 'vc', phoneNumber: '+15550001003', username: 'venuec' }).save()
    companyClaimant = await new UserModel({ firebaseUid: 'cc', phoneNumber: '+15550001004', username: 'compc' }).save()
    proposerUser = await new UserModel({ firebaseUid: 'p1', phoneNumber: '+15550001005', username: 'bob' }).save()
    secondProposerUser = await new UserModel({ firebaseUid: 'p2', phoneNumber: '+15550001006', username: 'carol' }).save()
    outsiderUser = await new UserModel({ firebaseUid: 'out', phoneNumber: '+15550001007', username: 'eve' }).save()
  })

  async function makeClaimedVenue(overrides: Record<string, any> = {}) {
    return new VenueModel({
      name: 'Test Venue',
      slug: `test-venue-${new Types.ObjectId().toString()}`,
      venueType: 'theater',
      submittedBy: adminUser._id,
      claimedBy: claimantUser._id,
      claimState: 'claimed-passive',
      description: 'Original description',
      ...overrides,
    }).save()
  }

  describe('queue + single-approver flow', () => {
    it('regular user editing claimed venue creates a Proposal (no direct write)', async () => {
      const venue = await makeClaimedVenue()
      const beforeDesc = venue.description

      const result = await callMutation(venueUpdate, {
        venueId: venue._id.toString(),
        description: 'Proposed new description',
      }, { user: { id: proposerUser._id.toString(), username: 'bob' } })

      expect(result.error).toBeUndefined()
      expect(result.queued).toBe(true)
      expect(result.proposalId).toBeTruthy()

      // Venue was not updated.
      const venueAfter = await VenueModel.findById(venue._id)
      expect(venueAfter?.description).toBe(beforeDesc)

      // A Proposal row exists.
      const proposal = await ProposalModel.findById(result.proposalId)
      expect(proposal).toBeTruthy()
      expect(proposal?.status).toBe('pending')
      expect(proposal?.diff?.description?.new).toBe('Proposed new description')
      expect(proposal?.diff?.description?.old).toBe('Original description')

      // Claimant got a notification.
      const notif = await NotificationModel.findOne({
        recipient: claimantUser._id,
        kind: 'proposal_received',
      })
      expect(notif).toBeTruthy()
    })

    it('claimant approving applies the diff + writes AuditLog attributed to proposer', async () => {
      const venue = await makeClaimedVenue()
      const queueResult = await callMutation(venueUpdate, {
        venueId: venue._id.toString(),
        description: 'New copy',
      }, { user: { id: proposerUser._id.toString(), username: 'bob' } })
      const proposalId = queueResult.proposalId

      const approveResult = await callMutation(approveProposal, {
        proposalId,
      }, { user: { id: claimantUser._id.toString() } })

      expect(approveResult.error).toBeUndefined()
      expect(approveResult.applied).toBe(true)

      const venueAfter = await VenueModel.findById(venue._id)
      expect(venueAfter?.description).toBe('New copy')

      // AuditLog row written, attributed to proposer.
      const auditRow = await AuditLogModel.findOne({ 'target.id': venue._id }).sort({ createdAt: -1 })
      expect(auditRow).toBeTruthy()
      expect(auditRow?.author.userId?.toString()).toBe(proposerUser._id.toString())
      expect(auditRow?.approvalSource).toBe('claimant-approved')
      expect(auditRow?.diff?.description?.new).toBe('New copy')

      // Proposer notified.
      const notif = await NotificationModel.findOne({
        recipient: proposerUser._id,
        kind: 'proposal_approved',
      })
      expect(notif).toBeTruthy()
    })

    it('claimant editing own venue auto-publishes (no Proposal created)', async () => {
      const venue = await makeClaimedVenue()
      const beforeCount = await ProposalModel.countDocuments()

      const result = await callMutation(venueUpdate, {
        venueId: venue._id.toString(),
        description: 'Owner edit',
      }, { user: { id: claimantUser._id.toString() } })

      expect(result.error).toBeUndefined()
      expect(result.queued).toBeFalsy()
      const venueAfter = await VenueModel.findById(venue._id)
      expect(venueAfter?.description).toBe('Owner edit')

      const afterCount = await ProposalModel.countDocuments()
      expect(afterCount).toBe(beforeCount)
    })

    it('decline marks proposal declined and notifies proposer', async () => {
      const venue = await makeClaimedVenue()
      const queueResult = await callMutation(venueUpdate, {
        venueId: venue._id.toString(),
        description: 'Should be declined',
      }, { user: { id: proposerUser._id.toString(), username: 'bob' } })

      const declineResult = await callMutation(declineProposal, {
        proposalId: queueResult.proposalId,
        reason: 'Not accurate',
      }, { user: { id: claimantUser._id.toString() } })

      expect(declineResult.error).toBeUndefined()

      const after = await ProposalModel.findById(queueResult.proposalId)
      expect(after?.status).toBe('declined')
      expect(after?.declineReason).toBe('Not accurate')

      const notif = await NotificationModel.findOne({
        recipient: proposerUser._id,
        kind: 'proposal_declined',
      })
      expect(notif).toBeTruthy()
    })

    it('non-claimant cannot approve someone else\'s claimed-venue proposal', async () => {
      const venue = await makeClaimedVenue()
      const queueResult = await callMutation(venueUpdate, {
        venueId: venue._id.toString(),
        description: 'Edit',
      }, { user: { id: proposerUser._id.toString(), username: 'bob' } })

      const approveResult = await callMutation(approveProposal, {
        proposalId: queueResult.proposalId,
      }, { user: { id: outsiderUser._id.toString() } })

      expect(approveResult.error).toMatch(/authorized/i)
    })
  })

  describe('conflict detection', () => {
    it('two pending proposals on same field flag each other as conflicting', async () => {
      const venue = await makeClaimedVenue()

      const first = await callMutation(venueUpdate, {
        venueId: venue._id.toString(),
        description: 'First proposal',
      }, { user: { id: proposerUser._id.toString(), username: 'bob' } })

      const second = await callMutation(venueUpdate, {
        venueId: venue._id.toString(),
        description: 'Second conflicting proposal',
      }, { user: { id: secondProposerUser._id.toString(), username: 'carol' } })

      const firstRow = await ProposalModel.findById(first.proposalId)
      const secondRow = await ProposalModel.findById(second.proposalId)

      expect(secondRow?.conflictsWithProposalIds.map(i => i.toString())).toContain(firstRow!._id.toString())
      expect(firstRow?.conflictsWithProposalIds.map(i => i.toString())).toContain(secondRow!._id.toString())
    })

    it('approving one conflicting proposal auto-declines the other', async () => {
      const venue = await makeClaimedVenue()

      const first = await callMutation(venueUpdate, {
        venueId: venue._id.toString(),
        description: 'A wins',
      }, { user: { id: proposerUser._id.toString(), username: 'bob' } })

      const second = await callMutation(venueUpdate, {
        venueId: venue._id.toString(),
        description: 'B loses',
      }, { user: { id: secondProposerUser._id.toString(), username: 'carol' } })

      const approveResult = await callMutation(approveProposal, {
        proposalId: first.proposalId,
      }, { user: { id: claimantUser._id.toString() } })
      expect(approveResult.error).toBeUndefined()

      const secondAfter = await ProposalModel.findById(second.proposalId)
      expect(secondAfter?.status).toBe('auto-declined-conflict')

      const venueAfter = await VenueModel.findById(venue._id)
      expect(venueAfter?.description).toBe('A wins')
    })
  })

  describe('joint stewardship (Performance)', () => {
    async function makeJointPerformance() {
      const venue = await new VenueModel({
        name: 'Joint Venue',
        slug: `joint-v-${new Types.ObjectId().toString()}`,
        venueType: 'theater',
        submittedBy: adminUser._id,
        claimedBy: venueClaimant._id,
        claimState: 'claimed-passive',
      }).save()
      const company = await new ProductionCompanyModel({
        name: 'Joint Co',
        slug: `joint-c-${new Types.ObjectId().toString()}`,
        submittedBy: adminUser._id,
        claimedBy: companyClaimant._id,
        claimState: 'claimed-passive',
      }).save()
      const show = await new ShowModel({
        title: `Show ${new Types.ObjectId().toString()}`,
        performanceTypes: ['play'],
        submittedBy: adminUser._id,
      }).save()
      const run = await new RunModel({
        show: show._id,
        productionCompany: company._id,
        venues: [venue._id],
        submittedBy: adminUser._id,
      }).save()
      const performance = await new PerformanceModel({
        run: run._id,
        venueId: venue._id,
        date: new Date('2026-07-01'),
        time: '19:30',
        submittedBy: adminUser._id,
      }).save()
      return { venue, company, performance }
    }

    it('non-claimant editing Performance creates joint proposal; first approval is partial', async () => {
      const { performance } = await makeJointPerformance()

      const queueResult = await callMutation(performanceUpdate, {
        performanceId: performance._id.toString(),
        time: '20:00',
      }, { user: { id: proposerUser._id.toString(), username: 'bob' } })

      expect(queueResult.queued).toBe(true)
      const proposal = await ProposalModel.findById(queueResult.proposalId)
      expect(proposal?.isJointStewardship).toBe(true)

      // Both claimants got notifications.
      const notifs = await NotificationModel.find({ kind: 'proposal_received' })
      const recipientIds = notifs.map(n => n.recipient.toString())
      expect(recipientIds).toContain(venueClaimant._id.toString())
      expect(recipientIds).toContain(companyClaimant._id.toString())

      // Venue claimant approves first.
      const firstApproval = await callMutation(approveProposal, {
        proposalId: queueResult.proposalId,
      }, { user: { id: venueClaimant._id.toString() } })

      expect(firstApproval.error).toBeUndefined()
      expect(firstApproval.applied).toBe(false)

      const after = await ProposalModel.findById(queueResult.proposalId)
      expect(after?.status).toBe('pending')
      expect(after?.firstApprovalAt).toBeTruthy()
      expect(after?.approvals).toHaveLength(1)
      expect(after?.approvals[0].role).toBe('venue-claimant')

      // Performance not yet updated.
      const perfMid = await PerformanceModel.findById(performance._id)
      expect(perfMid?.time).toBe('19:30')

      // Company claimant approves second — diff applies.
      const secondApproval = await callMutation(approveProposal, {
        proposalId: queueResult.proposalId,
      }, { user: { id: companyClaimant._id.toString() } })

      expect(secondApproval.error).toBeUndefined()
      expect(secondApproval.applied).toBe(true)

      const perfFinal = await PerformanceModel.findById(performance._id)
      expect(perfFinal?.time).toBe('20:00')

      const final = await ProposalModel.findById(queueResult.proposalId)
      expect(final?.status).toBe('approved')
    })

    it('decline kills a joint proposal regardless of partial approval', async () => {
      const { performance } = await makeJointPerformance()
      const queueResult = await callMutation(performanceUpdate, {
        performanceId: performance._id.toString(),
        time: '21:00',
      }, { user: { id: proposerUser._id.toString(), username: 'bob' } })

      // Venue side approves
      await callMutation(approveProposal, {
        proposalId: queueResult.proposalId,
      }, { user: { id: venueClaimant._id.toString() } })

      // Company side declines
      const declineResult = await callMutation(declineProposal, {
        proposalId: queueResult.proposalId,
      }, { user: { id: companyClaimant._id.toString() } })

      expect(declineResult.error).toBeUndefined()

      const after = await ProposalModel.findById(queueResult.proposalId)
      expect(after?.status).toBe('declined')

      const perf = await PerformanceModel.findById(performance._id)
      expect(perf?.time).toBe('19:30')
    })

    it('timeout cron auto-approves joint proposal after 14 days with one approval', async () => {
      const { performance } = await makeJointPerformance()
      const queueResult = await callMutation(performanceUpdate, {
        performanceId: performance._id.toString(),
        time: '22:00',
      }, { user: { id: proposerUser._id.toString(), username: 'bob' } })

      // Venue side approves
      await callMutation(approveProposal, {
        proposalId: queueResult.proposalId,
      }, { user: { id: venueClaimant._id.toString() } })

      // Backdate firstApprovalAt to >14d ago
      await ProposalModel.updateOne(
        { _id: queueResult.proposalId },
        { $set: { firstApprovalAt: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000) } }
      )

      const result = await processProposalTimeoutCheck()
      expect(result.autoApproved).toBeGreaterThanOrEqual(1)

      const after = await ProposalModel.findById(queueResult.proposalId)
      expect(after?.status).toBe('auto-approved')

      const perf = await PerformanceModel.findById(performance._id)
      expect(perf?.time).toBe('22:00')

      const auditRow = await AuditLogModel.findOne({ 'target.id': performance._id }).sort({ createdAt: -1 })
      expect(auditRow?.approvalSource).toBe('timeout-approved')

      // Both claimants + proposer notified.
      const notifs = await NotificationModel.find({ kind: 'proposal_timeout_auto_approved' })
      const recipientIds = notifs.map(n => n.recipient.toString())
      expect(recipientIds).toContain(venueClaimant._id.toString())
      expect(recipientIds).toContain(companyClaimant._id.toString())
      expect(recipientIds).toContain(proposerUser._id.toString())
    })

    it('timeout cron sends 10-day warning to silent party once', async () => {
      const { performance } = await makeJointPerformance()
      const queueResult = await callMutation(performanceUpdate, {
        performanceId: performance._id.toString(),
        time: '17:00',
      }, { user: { id: proposerUser._id.toString(), username: 'bob' } })

      await callMutation(approveProposal, {
        proposalId: queueResult.proposalId,
      }, { user: { id: venueClaimant._id.toString() } })

      // Backdate to 11 days ago
      await ProposalModel.updateOne(
        { _id: queueResult.proposalId },
        { $set: { firstApprovalAt: new Date(Date.now() - 11 * 24 * 60 * 60 * 1000) } }
      )

      const r1 = await processProposalTimeoutCheck()
      expect(r1.warningsSent).toBeGreaterThanOrEqual(1)

      const warningCount = await NotificationModel.countDocuments({
        recipient: companyClaimant._id,
        kind: 'proposal_timeout_warning',
      })
      expect(warningCount).toBe(1)

      // Running again does not duplicate.
      await processProposalTimeoutCheck()
      const warningCount2 = await NotificationModel.countDocuments({
        recipient: companyClaimant._id,
        kind: 'proposal_timeout_warning',
      })
      expect(warningCount2).toBe(1)
    })
  })
})
