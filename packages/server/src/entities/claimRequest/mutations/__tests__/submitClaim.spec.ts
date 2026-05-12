import { Types } from 'mongoose'
import { UserModel } from '../../../user/userModel'
import { VenueModel } from '../../../venue/venueModel'
import { ProductionCompanyModel } from '../../../productionCompany/productionCompanyModel'
import { PersonModel } from '../../../person/personModel'
import { ClaimRequestModel } from '../../claimRequestModel'
import { NotificationModel } from '../../../notification/notificationModel'
import { submitClaim } from '../submitClaim'
import { approveClaim } from '../approveClaim'
import { declineClaim } from '../declineClaim'

// End-to-end mutation tests for the polymorphic claim flow (Phase 2).
// Drives the resolver directly with a fake context — no GraphQL layer needed
// since the mutation logic is the surface under test.

async function callMutation(mutation: any, input: any, ctx: any) {
  // mutationWithClientMutationId wraps mutateAndGetPayload in a `resolve` function.
  // Call it directly with the relay input shape.
  return mutation.resolve(null, { input }, ctx, null)
}

describe('Polymorphic claim mutations (Phase 2)', () => {
  let adminUser: any
  let claimantUser: any
  let otherUser: any
  let venue: any
  let company: any
  let person: any

  beforeEach(async () => {
    await Promise.all([
      UserModel.deleteMany({}),
      VenueModel.deleteMany({}),
      ProductionCompanyModel.deleteMany({}),
      PersonModel.deleteMany({}),
      ClaimRequestModel.deleteMany({}),
      NotificationModel.deleteMany({}),
    ])

    adminUser = await new UserModel({
      firebaseUid: 'admin-uid', phoneNumber: '+15550000001', username: 'admin', isAdmin: true,
    }).save()
    claimantUser = await new UserModel({
      firebaseUid: 'claimant-uid', phoneNumber: '+15550000002', username: 'alice',
    }).save()
    otherUser = await new UserModel({
      firebaseUid: 'other-uid', phoneNumber: '+15550000003', username: 'bob',
    }).save()

    venue = await new VenueModel({
      name: 'Test Venue',
      slug: `test-venue-${new Types.ObjectId().toString()}`,
      venueType: 'theater',
      submittedBy: adminUser._id,
    }).save()
    company = await new ProductionCompanyModel({
      name: 'Test Company',
      slug: `test-company-${new Types.ObjectId().toString()}`,
      submittedBy: adminUser._id,
    }).save()
    person = await new PersonModel({
      name: 'Test Person',
      slug: `test-person-${new Types.ObjectId().toString()}`,
      submittedBy: adminUser._id,
    }).save()
  })

  describe('submitClaim', () => {
    it('creates a ClaimRequest for a venue and transitions state to provisionally-claimed', async () => {
      const result = await callMutation(submitClaim, {
        targetKind: 'venue', targetId: venue._id.toString(), evidence: 'I am the marketing director of this venue.',
      }, { user: { id: claimantUser._id.toString() } })

      expect(result.error).toBeUndefined()
      expect(result.claimRequest).toBeDefined()

      const updatedVenue = await VenueModel.findById(venue._id)
      expect(updatedVenue?.claimState).toBe('provisionally-claimed')

      const cr = await ClaimRequestModel.findById(result.claimRequest._id)
      expect(cr?.target?.kind).toBe('venue')
      expect(cr?.target?.id.toString()).toBe(venue._id.toString())
      expect(cr?.message).toContain('marketing director')
    })

    it('rejects empty evidence', async () => {
      const result = await callMutation(submitClaim, {
        targetKind: 'venue', targetId: venue._id.toString(), evidence: '   ',
      }, { user: { id: claimantUser._id.toString() } })

      expect(result.error).toMatch(/evidence/i)
    })

    it('rejects an invalid targetKind', async () => {
      const result = await callMutation(submitClaim, {
        targetKind: 'spaceship', targetId: venue._id.toString(), evidence: 'lol',
      }, { user: { id: claimantUser._id.toString() } })

      expect(result.error).toMatch(/Invalid targetKind/)
    })

    it('rejects when the unit is already claimed', async () => {
      await VenueModel.updateOne({ _id: venue._id }, {
        $set: { claimState: 'claimed-passive', claimedBy: otherUser._id, claimedAt: new Date() }
      })

      const result = await callMutation(submitClaim, {
        targetKind: 'venue', targetId: venue._id.toString(), evidence: 'I want it now.',
      }, { user: { id: claimantUser._id.toString() } })

      expect(result.error).toMatch(/already been claimed/i)
    })

    it('rejects unauthenticated submissions', async () => {
      const result = await callMutation(submitClaim, {
        targetKind: 'venue', targetId: venue._id.toString(), evidence: 'hi',
      }, { user: null })

      expect(result.error).toBe('Authentication required')
    })
  })

  describe('approveClaim', () => {
    it('transitions provisionally-claimed to claimed-passive and fires claim_approved notification', async () => {
      // First submit
      await callMutation(submitClaim, {
        targetKind: 'venue', targetId: venue._id.toString(), evidence: 'Manager here.',
      }, { user: { id: claimantUser._id.toString() } })
      const cr = await ClaimRequestModel.findOne({ user: claimantUser._id })

      const result = await callMutation(approveClaim, {
        claimRequestId: cr!._id.toString(), reviewerNotes: 'Verified via website.',
      }, { user: { id: adminUser._id.toString() } })

      expect(result.error).toBeUndefined()

      const updated = await VenueModel.findById(venue._id)
      expect(updated?.claimState).toBe('claimed-passive')
      expect(updated?.claimedBy?.toString()).toBe(claimantUser._id.toString())
      expect(updated?.claimedAt).toBeTruthy()

      const updatedCR = await ClaimRequestModel.findById(cr!._id)
      expect(updatedCR?.status).toBe('approved')
      expect(updatedCR?.reviewerNotes).toBe('Verified via website.')

      const notifications = await NotificationModel.find({
        recipient: claimantUser._id,
        kind: 'claim_approved',
      })
      expect(notifications).toHaveLength(1)
      expect((notifications[0].context as any).targetName).toBe('Test Venue')
    })

    it('rejects non-admin attempts', async () => {
      await callMutation(submitClaim, {
        targetKind: 'venue', targetId: venue._id.toString(), evidence: 'hi',
      }, { user: { id: claimantUser._id.toString() } })
      const cr = await ClaimRequestModel.findOne({ user: claimantUser._id })

      const result = await callMutation(approveClaim, {
        claimRequestId: cr!._id.toString(),
      }, { user: { id: otherUser._id.toString() } })

      expect(result.error).toBe('Admin access required')
    })

    it('also writes legacy userId/personId on Person claims', async () => {
      await callMutation(submitClaim, {
        targetKind: 'person', targetId: person._id.toString(), evidence: 'This is me.',
      }, { user: { id: claimantUser._id.toString() } })
      const cr = await ClaimRequestModel.findOne({ user: claimantUser._id })

      await callMutation(approveClaim, {
        claimRequestId: cr!._id.toString(),
      }, { user: { id: adminUser._id.toString() } })

      const updatedPerson = await PersonModel.findById(person._id)
      expect(updatedPerson?.userId?.toString()).toBe(claimantUser._id.toString())

      const updatedUser = await UserModel.findById(claimantUser._id)
      expect(updatedUser?.personId?.toString()).toBe(person._id.toString())
    })
  })

  describe('declineClaim', () => {
    it('reverts provisionally-claimed to unclaimed and fires claim_declined notification', async () => {
      await callMutation(submitClaim, {
        targetKind: 'productionCompany', targetId: company._id.toString(), evidence: 'I am the AD.',
      }, { user: { id: claimantUser._id.toString() } })
      const cr = await ClaimRequestModel.findOne({ user: claimantUser._id })

      const result = await callMutation(declineClaim, {
        claimRequestId: cr!._id.toString(), reviewerNotes: 'Need more evidence.',
      }, { user: { id: adminUser._id.toString() } })

      expect(result.error).toBeUndefined()

      const updated = await ProductionCompanyModel.findById(company._id)
      expect(updated?.claimState).toBe('unclaimed')
      expect(updated?.claimedBy).toBeNull()

      const notifications = await NotificationModel.find({
        recipient: claimantUser._id,
        kind: 'claim_declined',
      })
      expect(notifications).toHaveLength(1)
      expect((notifications[0].context as any).reviewerNotes).toBe('Need more evidence.')
    })

    it('does NOT revert to unclaimed when other pending claims still exist', async () => {
      await callMutation(submitClaim, {
        targetKind: 'venue', targetId: venue._id.toString(), evidence: 'Alice here.',
      }, { user: { id: claimantUser._id.toString() } })
      await callMutation(submitClaim, {
        targetKind: 'venue', targetId: venue._id.toString(), evidence: 'Bob here.',
      }, { user: { id: otherUser._id.toString() } })

      const aliceCR = await ClaimRequestModel.findOne({ user: claimantUser._id })

      await callMutation(declineClaim, {
        claimRequestId: aliceCR!._id.toString(),
      }, { user: { id: adminUser._id.toString() } })

      // Bob's claim is still pending — venue stays provisionally-claimed
      const updated = await VenueModel.findById(venue._id)
      expect(updated?.claimState).toBe('provisionally-claimed')
    })
  })
})
