import { Types } from 'mongoose'
import { UserModel } from '../../../entities/user/userModel'
import { VenueModel } from '../../../entities/venue/venueModel'
import { AuditLogModel } from '../../../entities/auditLog/auditLogModel'
import { writeAuditLog } from '../writeAuditLog'
import { venueUpdate } from '../../../entities/venue/mutations/venueUpdate'
import { revertAuditLogEntry } from '../../../entities/auditLog/mutations/revertAuditLogEntry'
import { hideAuditLogEntry } from '../../../entities/auditLog/mutations/hideAuditLogEntry'
import { auditLogQueries } from '../../../entities/auditLog/queries/queries'

// Phase 3 — AuditLog service + revert + hide + stale-version coverage.
// Drives mutations directly via .resolve(null, { input }, ctx, null) — same
// pattern as canPerform/submitClaim suites.

async function callMutation(mutation: any, input: any, ctx: any) {
  return mutation.resolve(null, { input }, ctx, null)
}

describe('writeAuditLog + edit-history mutations (Phase 3)', () => {
  let adminUser: any
  let claimantUser: any
  let otherUser: any

  beforeEach(async () => {
    await Promise.all([
      UserModel.deleteMany({}),
      VenueModel.deleteMany({}),
      AuditLogModel.deleteMany({}),
    ])

    adminUser = await new UserModel({
      firebaseUid: 'admin-uid', phoneNumber: '+15550000001', username: 'admin', isAdmin: true,
    }).save()
    claimantUser = await new UserModel({
      firebaseUid: 'claimant-uid', phoneNumber: '+15550000002', username: 'claimant',
    }).save()
    otherUser = await new UserModel({
      firebaseUid: 'other-uid', phoneNumber: '+15550000003', username: 'other',
    }).save()
  })

  async function makeVenue(overrides: Record<string, any> = {}) {
    return new VenueModel({
      name: 'Original Venue',
      slug: `venue-${new Types.ObjectId().toString()}`,
      venueType: 'theater',
      description: 'Original description',
      submittedBy: adminUser._id,
      claimedBy: claimantUser._id,
      claimState: 'claimed-passive',
      ...overrides,
    }).save()
  }

  describe('writeAuditLog helper', () => {
    it('computes diff for changed fields only', async () => {
      const venue = await makeVenue()
      const oldDoc = venue.toObject()
      venue.description = 'New description'
      venue.city = 'NYC'
      await venue.save()

      const entry = await writeAuditLog({
        target: { kind: 'Venue', id: venue._id },
        author: { kind: 'User', userId: adminUser._id },
        oldDoc,
        newDoc: venue.toObject(),
        approvalSource: 'direct-publish',
      })

      const keys = Object.keys(entry.diff)
      expect(keys).toContain('description')
      expect(keys).toContain('city')
      expect(keys).not.toContain('name')
      expect(keys).not.toContain('createdAt')
      expect(keys).not.toContain('updatedAt')
      expect(entry.diff.description.old).toBe('Original description')
      expect(entry.diff.description.new).toBe('New description')
    })

    it('records _created snapshot when oldDoc is null', async () => {
      const venue = await makeVenue()
      const entry = await writeAuditLog({
        target: { kind: 'Venue', id: venue._id },
        author: { kind: 'User', userId: adminUser._id },
        oldDoc: null,
        newDoc: venue.toObject(),
        approvalSource: 'direct-publish',
      })
      expect(entry.diff._created).toBe(true)
      expect(entry.diff.snapshot).toBeDefined()
    })
  })

  describe('venueUpdate writes AuditLog', () => {
    it('produces one AuditLog row with the right diff on update', async () => {
      const venue = await makeVenue()

      const before = await AuditLogModel.countDocuments()
      const result = await callMutation(venueUpdate, {
        venueId: venue._id.toString(),
        description: 'Updated description',
      }, { user: { id: claimantUser._id.toString() } })

      expect(result.error).toBeUndefined()
      const after = await AuditLogModel.countDocuments()
      expect(after).toBe(before + 1)

      const row = await AuditLogModel.findOne({ 'target.id': venue._id }).sort({ createdAt: -1 })
      expect(row).toBeTruthy()
      expect(row?.diff.description.old).toBe('Original description')
      expect(row?.diff.description.new).toBe('Updated description')
      expect(row?.author.userId?.toString()).toBe(claimantUser._id.toString())
      expect(row?.approvalSource).toBe('direct-publish')
    })

    it('no-op update writes no AuditLog row', async () => {
      const venue = await makeVenue()
      // No actual changes — all fields undefined.
      const before = await AuditLogModel.countDocuments()
      await callMutation(venueUpdate, {
        venueId: venue._id.toString(),
      }, { user: { id: claimantUser._id.toString() } })
      const after = await AuditLogModel.countDocuments()
      expect(after).toBe(before)
    })
  })

  describe('stale-version detection', () => {
    it('rejects edit when expectedUpdatedAt is older than current updatedAt', async () => {
      const venue = await makeVenue()
      const staleToken = new Date(venue.updatedAt.getTime() - 60_000).toISOString()

      // Bump the venue by writing through the model directly (simulates a
      // concurrent writer).
      await VenueModel.updateOne({ _id: venue._id }, { description: 'Concurrent edit' })

      const result = await callMutation(venueUpdate, {
        venueId: venue._id.toString(),
        description: 'My edit',
        expectedUpdatedAt: staleToken,
      }, { user: { id: claimantUser._id.toString() } })

      expect(result.error).toMatch(/STALE_VERSION/)
    })

    it('accepts edit when expectedUpdatedAt matches current updatedAt', async () => {
      const venue = await makeVenue()
      const result = await callMutation(venueUpdate, {
        venueId: venue._id.toString(),
        description: 'Fresh edit',
        expectedUpdatedAt: venue.updatedAt.toISOString(),
      }, { user: { id: claimantUser._id.toString() } })
      expect(result.error).toBeUndefined()
    })
  })

  describe('revertAuditLogEntry', () => {
    it('reverts a prior edit and creates a new AuditLog row marked isRevert', async () => {
      const venue = await makeVenue()
      // First edit
      await callMutation(venueUpdate, {
        venueId: venue._id.toString(),
        description: 'Changed once',
      }, { user: { id: claimantUser._id.toString() } })

      const firstEntry = await AuditLogModel.findOne({ 'target.id': venue._id }).sort({ createdAt: -1 })
      expect(firstEntry).toBeTruthy()

      // Revert
      const result = await callMutation(revertAuditLogEntry, {
        auditLogEntryId: firstEntry!._id.toString(),
      }, { user: { id: claimantUser._id.toString() } })

      expect(result.error).toBeUndefined()
      expect(result.auditLogEntry).toBeTruthy()
      expect(result.auditLogEntry.isRevert).toBe(true)
      expect(result.auditLogEntry.revertOf?.toString()).toBe(firstEntry!._id.toString())

      const venueAfter = await VenueModel.findById(venue._id)
      expect(venueAfter?.description).toBe('Original description')
    })
  })

  describe('hideAuditLogEntry + public query filtering', () => {
    it('admin can hide a row; public query suppresses its diff', async () => {
      const venue = await makeVenue()
      await callMutation(venueUpdate, {
        venueId: venue._id.toString(),
        description: 'Sensitive change',
      }, { user: { id: claimantUser._id.toString() } })

      const entry = await AuditLogModel.findOne({ 'target.id': venue._id }).sort({ createdAt: -1 })

      const result = await callMutation(hideAuditLogEntry, {
        auditLogEntryId: entry!._id.toString(),
        reason: 'Privacy',
      }, { user: { id: adminUser._id.toString() } })

      expect(result.error).toBeUndefined()

      const hidden = await AuditLogModel.findById(entry!._id)
      expect(hidden?.hiddenAt).toBeTruthy()

      // Non-admin public query: the row is still returned but its diff is suppressed.
      const publicResult: any = await auditLogQueries.auditLog.resolve(
        null,
        { targetKind: 'Venue', targetId: venue._id.toString(), first: 10 },
        { user: { id: otherUser._id.toString() } },
      )
      const publicRow = publicResult.edges.find((e: any) => e.node._id.toString() === entry!._id.toString())
      expect(publicRow).toBeTruthy()
      expect(publicRow.node.diff._hidden).toBe(true)
      expect(publicRow.node.hiddenReason).toBeNull()

      // Admin query returns full diff.
      const adminResult: any = await auditLogQueries.auditLog.resolve(
        null,
        { targetKind: 'Venue', targetId: venue._id.toString(), first: 10 },
        { user: { id: adminUser._id.toString() } },
      )
      const adminRow = adminResult.edges.find((e: any) => e.node._id.toString() === entry!._id.toString())
      expect(adminRow.node.diff.description).toBeDefined()
    })

    it('non-admin cannot hide a row', async () => {
      const venue = await makeVenue()
      await callMutation(venueUpdate, {
        venueId: venue._id.toString(),
        description: 'A change',
      }, { user: { id: claimantUser._id.toString() } })
      const entry = await AuditLogModel.findOne({ 'target.id': venue._id }).sort({ createdAt: -1 })

      const result = await callMutation(hideAuditLogEntry, {
        auditLogEntryId: entry!._id.toString(),
        reason: 'sneaky',
      }, { user: { id: otherUser._id.toString() } })

      expect(result.error).toMatch(/Admin/)
    })
  })
})
