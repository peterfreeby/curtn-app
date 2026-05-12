import { Types } from 'mongoose'
import { canPerform } from '../canPerform'
import { checkAntiAbuse, isAutoconfirmed } from '../checkAntiAbuse'
import { ANTI_ABUSE, ONE_DAY_MS } from '../antiAbuseConfig'
import { UserModel } from '../../entities/user/userModel'
import { VenueModel } from '../../entities/venue/venueModel'
import { ProductionCompanyModel } from '../../entities/productionCompany/productionCompanyModel'
import { PersonModel } from '../../entities/person/personModel'
import { ProposalModel } from '../../entities/proposal/proposalModel'
import { AuditLogModel } from '../../entities/auditLog/auditLogModel'
import { BlockModel } from '../../entities/block/blockModel'
import { NotificationModel } from '../../entities/notification/notificationModel'
import { blockUser } from '../../entities/block/mutations/blockUser'
import { unblockUser } from '../../entities/block/mutations/unblockUser'
import { createProposal } from '../../entities/proposal/mutations/createProposal'
import { approveProposal } from '../../entities/proposal/mutations/approveProposal'
import { processBlockVolumeCheck } from '../../services/antiAbuse/processBlockVolumeCheck'

// Phase 7 — anti-abuse layers. Tests cover rate limits, autoconfirmed gate,
// blocks (including silent rejection + audit row), claimant-bypass, and the
// high-volume-block admin alert.

async function callMutation(mutation: any, input: any, ctx: any) {
  return mutation.resolve(null, { input }, ctx)
}

async function seedProposalRows(opts: {
  userId: Types.ObjectId
  targetKind: 'Venue'
  targetId: Types.ObjectId
  count: number
  ageMs?: number
}) {
  const baseTime = Date.now() - (opts.ageMs ?? 0)
  for (let i = 0; i < opts.count; i += 1) {
    await ProposalModel.create({
      target: { kind: opts.targetKind, id: opts.targetId },
      proposer: { kind: 'User', userId: opts.userId },
      diff: { description: { old: 'a', new: `b${i}` } },
      submissionVersion: new Date(),
      status: 'pending',
      isJointStewardship: false,
      approvals: [],
      conflictsWithProposalIds: [],
      isCommunityReview: false,
      createdAt: new Date(baseTime - i),
      updatedAt: new Date(baseTime - i),
    })
  }
}

describe('Phase 7 — anti-abuse', () => {
  let adminUser: any
  let claimantUser: any
  let proposerUser: any
  let venue: any

  beforeEach(async () => {
    await Promise.all([
      UserModel.deleteMany({}),
      VenueModel.deleteMany({}),
      ProductionCompanyModel.deleteMany({}),
      PersonModel.deleteMany({}),
      ProposalModel.deleteMany({}),
      AuditLogModel.deleteMany({}),
      BlockModel.deleteMany({}),
      NotificationModel.deleteMany({}),
    ])

    adminUser = await new UserModel({
      firebaseUid: 'p7-admin',
      phoneNumber: '+15557000001',
      username: 'admin7',
      isAdmin: true,
    }).save()

    claimantUser = await new UserModel({
      firebaseUid: 'p7-claim',
      phoneNumber: '+15557000002',
      username: 'claim7',
    }).save()

    proposerUser = await new UserModel({
      firebaseUid: 'p7-prop',
      phoneNumber: '+15557000003',
      username: 'prop7',
    }).save()

    venue = await new VenueModel({
      name: 'Phase 7 Test Venue',
      slug: `p7-venue-${new Types.ObjectId().toString()}`,
      venueType: 'theater',
      submittedBy: adminUser._id,
      claimedBy: claimantUser._id,
      claimState: 'claimed-passive',
    }).save()
  })

  describe('rate limits', () => {
    it('rejects the 6th edit on the same record in 24h', async () => {
      // Seed 5 fresh proposals — at PER_RECORD_LIMIT.
      await seedProposalRows({
        userId: proposerUser._id,
        targetKind: 'Venue',
        targetId: venue._id,
        count: ANTI_ABUSE.PER_RECORD_LIMIT,
      })

      const result = await checkAntiAbuse(proposerUser._id.toString(), {
        kind: 'Venue',
        id: venue._id,
      })
      expect(result.allowed).toBe(false)
      expect(result.reason).toBe('rate_limited_record')

      const decision = await canPerform(proposerUser._id.toString(), 'venue.edit_description', {
        kind: 'Venue',
        id: venue._id,
      })
      expect(decision.mode).toBe('denied')
      expect(decision.reason).toBe('rate_limited_record')
    })

    it('allows the 5th edit on the same record (at-limit boundary)', async () => {
      await seedProposalRows({
        userId: proposerUser._id,
        targetKind: 'Venue',
        targetId: venue._id,
        count: ANTI_ABUSE.PER_RECORD_LIMIT - 1,
      })
      const result = await checkAntiAbuse(proposerUser._id.toString(), {
        kind: 'Venue',
        id: venue._id,
      })
      expect(result.allowed).toBe(true)
    })

    it('rejects the 101st edit globally in 24h', async () => {
      // Build 100 proposals targeting different venues so per-record limit
      // doesn't fire first.
      for (let i = 0; i < ANTI_ABUSE.GLOBAL_VELOCITY_LIMIT; i += 1) {
        const v = await new VenueModel({
          name: `v-${i}`,
          slug: `v-${new Types.ObjectId().toString()}`,
          venueType: 'theater',
          submittedBy: adminUser._id,
        }).save()
        await ProposalModel.create({
          target: { kind: 'Venue', id: v._id },
          proposer: { kind: 'User', userId: proposerUser._id },
          diff: { description: { old: 'a', new: 'b' } },
          submissionVersion: new Date(),
          status: 'pending',
          isJointStewardship: false,
          approvals: [],
          conflictsWithProposalIds: [],
          isCommunityReview: false,
        })
      }
      const result = await checkAntiAbuse(proposerUser._id.toString(), {
        kind: 'Venue',
        id: venue._id,
      })
      expect(result.allowed).toBe(false)
      expect(result.reason).toBe('rate_limited_global')
    })

    it('claimant editing their own unit bypasses rate limits', async () => {
      // 10 proposals from the claimant on their own venue — well over PER_RECORD_LIMIT.
      await seedProposalRows({
        userId: claimantUser._id,
        targetKind: 'Venue',
        targetId: venue._id,
        count: ANTI_ABUSE.PER_RECORD_LIMIT + 5,
      })
      const result = await checkAntiAbuse(claimantUser._id.toString(), {
        kind: 'Venue',
        id: venue._id,
      })
      expect(result.allowed).toBe(true)

      const decision = await canPerform(claimantUser._id.toString(), 'venue.edit_description', {
        kind: 'Venue',
        id: venue._id,
      })
      expect(decision.mode).toBe('auto-publish')
    })
  })

  describe('autoconfirmed gate', () => {
    it('non-autoconfirmed user → unclaimed record routes to community-review queue', async () => {
      const unclaimedVenue = await new VenueModel({
        name: 'Unclaimed',
        slug: `unclaimed-${new Types.ObjectId().toString()}`,
        venueType: 'theater',
        submittedBy: adminUser._id,
      }).save()
      const decision = await canPerform(proposerUser._id.toString(), 'venue.edit_description', {
        kind: 'Venue',
        id: unclaimedVenue._id,
      })
      expect(decision.mode).toBe('queue')
      expect(decision.isCommunityReview).toBe(true)
    })

    it('autoconfirmed user → unclaimed record auto-publishes', async () => {
      const oldEnough = new Date(Date.now() - (ANTI_ABUSE.AUTOCONFIRMED_DAYS + 1) * ONE_DAY_MS)
      await UserModel.updateOne({ _id: proposerUser._id }, {
        $set: { createdAt: oldEnough, editCount: ANTI_ABUSE.AUTOCONFIRMED_EDITS + 1 },
      })

      const auto = await isAutoconfirmed(proposerUser._id.toString())
      expect(auto).toBe(true)

      const unclaimedVenue = await new VenueModel({
        name: 'Unclaimed 2',
        slug: `unclaimed-${new Types.ObjectId().toString()}`,
        venueType: 'theater',
        submittedBy: adminUser._id,
      }).save()
      const decision = await canPerform(proposerUser._id.toString(), 'venue.edit_description', {
        kind: 'Venue',
        id: unclaimedVenue._id,
      })
      expect(decision.mode).toBe('auto-publish')
    })

    it('community-review proposal approved by an autoconfirmed (non-claimant) user', async () => {
      const unclaimedVenue = await new VenueModel({
        name: 'CR Venue',
        slug: `cr-${new Types.ObjectId().toString()}`,
        venueType: 'theater',
        submittedBy: adminUser._id,
        description: 'old',
      }).save()
      // Create the proposal as a non-autoconfirmed user
      const result = await createProposal({
        target: { kind: 'Venue', id: unclaimedVenue._id },
        proposer: { kind: 'User', userId: proposerUser._id, label: 'prop7' },
        diff: { description: { old: 'old', new: 'new' } },
        submissionVersion: unclaimedVenue.updatedAt,
        isCommunityReview: true,
      })
      // Promote claimantUser to autoconfirmed
      const oldEnough = new Date(Date.now() - (ANTI_ABUSE.AUTOCONFIRMED_DAYS + 1) * ONE_DAY_MS)
      await UserModel.updateOne({ _id: claimantUser._id }, {
        $set: { createdAt: oldEnough, editCount: ANTI_ABUSE.AUTOCONFIRMED_EDITS + 1 },
      })

      const approveResult = await callMutation(
        approveProposal,
        { proposalId: result.proposalId },
        { user: { id: claimantUser._id.toString() } },
      )
      expect(approveResult.applied).toBe(true)
      // The diff was applied — venue now has new description.
      const v = await VenueModel.findById(unclaimedVenue._id).lean()
      expect(v?.description).toBe('new')

      // AuditLog row recorded with community-approved approvalSource.
      const audit = await AuditLogModel.findOne({
        'target.kind': 'Venue',
        'target.id': unclaimedVenue._id,
        approvalSource: 'community-approved',
      }).lean()
      expect(audit).toBeTruthy()
    })
  })

  describe('block list', () => {
    it("blocks silently reject the blocked user's proposal-path edits", async () => {
      // Claimant blocks proposerUser on the venue.
      const blockRes = await callMutation(
        blockUser,
        {
          scopedToKind: 'Venue',
          scopedToId: venue._id.toString(),
          blockedUserId: proposerUser._id.toString(),
          reason: 'spam',
        },
        { user: { id: claimantUser._id.toString() } },
      )
      expect(blockRes.error).toBeUndefined()

      // canPerform now denies with reason 'blocked'.
      const decision = await canPerform(proposerUser._id.toString(), 'venue.edit_description', {
        kind: 'Venue',
        id: venue._id,
      })
      expect(decision.mode).toBe('denied')
      expect(decision.reason).toBe('blocked')
    })

    it('writes an AuditLog row attributed to the blocker on block creation', async () => {
      await callMutation(
        blockUser,
        {
          scopedToKind: 'Venue',
          scopedToId: venue._id.toString(),
          blockedUserId: proposerUser._id.toString(),
        },
        { user: { id: claimantUser._id.toString() } },
      )
      const row = await AuditLogModel.findOne({
        'target.kind': 'Venue',
        'target.id': venue._id,
        'approvalContext.action': 'block_created',
      }).lean()
      expect(row).toBeTruthy()
      expect(row?.author?.userId?.toString()).toBe(claimantUser._id.toString())
    })

    it('non-claimant cannot block on a unit they do not own', async () => {
      const res = await callMutation(
        blockUser,
        {
          scopedToKind: 'Venue',
          scopedToId: venue._id.toString(),
          blockedUserId: claimantUser._id.toString(),
        },
        { user: { id: proposerUser._id.toString() } },
      )
      expect(res.error).toMatch(/claimant/i)
    })

    it('unblock restores the blocked user', async () => {
      const blockRes = await callMutation(
        blockUser,
        {
          scopedToKind: 'Venue',
          scopedToId: venue._id.toString(),
          blockedUserId: proposerUser._id.toString(),
        },
        { user: { id: claimantUser._id.toString() } },
      )
      const blockId = blockRes.block._id.toString()
      const unRes = await callMutation(
        unblockUser,
        { blockId },
        { user: { id: claimantUser._id.toString() } },
      )
      expect(unRes.success).toBe(true)

      const decision = await canPerform(proposerUser._id.toString(), 'venue.edit_description', {
        kind: 'Venue',
        id: venue._id,
      })
      expect(decision.mode).not.toBe('denied')
    })
  })

  describe('block volume cron', () => {
    it('fires high_block_volume_alert when a claimant crosses the threshold', async () => {
      // Make ANOTHER admin so we can confirm fan-out
      const admin2 = await new UserModel({
        firebaseUid: 'p7-admin2',
        phoneNumber: '+15557009999',
        username: 'admin72',
        isAdmin: true,
      }).save()

      // Seed THRESHOLD + 1 blocks from claimantUser on freshly-claimed venues.
      const count = ANTI_ABUSE.BLOCK_VOLUME_ALERT_THRESHOLD + 1
      for (let i = 0; i < count; i += 1) {
        const v = await new VenueModel({
          name: `bv-${i}`,
          slug: `bv-${new Types.ObjectId().toString()}`,
          venueType: 'theater',
          submittedBy: adminUser._id,
          claimedBy: claimantUser._id,
          claimState: 'claimed-passive',
        }).save()
        const blocked = await new UserModel({
          firebaseUid: `bv-u-${i}`,
          phoneNumber: `+1555800${i.toString().padStart(4, '0')}`,
          username: `bvu${i}`,
        }).save()
        await new BlockModel({
          blocker: claimantUser._id,
          blockedUser: blocked._id,
          scopedTo: { kind: 'Venue', id: v._id },
        }).save()
      }

      const result = await processBlockVolumeCheck()
      expect(result.flagged).toBe(1)
      // 2 admins × 1 flagged blocker = 2 notifications
      expect(result.notificationsCreated).toBe(2)

      const adminNotifs = await NotificationModel.find({
        recipient: { $in: [adminUser._id, admin2._id] },
        kind: 'high_block_volume_alert',
      }).lean()
      expect(adminNotifs.length).toBe(2)
      expect((adminNotifs[0].context as any).blockerId).toBe(claimantUser._id.toString())
    })

    it('does not fire when no claimant is over threshold', async () => {
      // One block — below threshold.
      const blocked = await new UserModel({
        firebaseUid: 'bv-low',
        phoneNumber: '+15558009999',
        username: 'bvlow',
      }).save()
      await new BlockModel({
        blocker: claimantUser._id,
        blockedUser: blocked._id,
        scopedTo: { kind: 'Venue', id: venue._id },
      }).save()
      const result = await processBlockVolumeCheck()
      expect(result.notificationsCreated).toBe(0)
    })
  })
})
