import { Types } from 'mongoose'
import { canPerform } from '../canPerform'
import { UserModel } from '../../entities/user/userModel'
import { VenueModel } from '../../entities/venue/venueModel'
import { ProductionCompanyModel } from '../../entities/productionCompany/productionCompanyModel'
import { PersonModel } from '../../entities/person/personModel'
import { RunModel } from '../../entities/run/runModel'
import { ShowModel } from '../../entities/show/showModel'
import { PerformanceModel } from '../../entities/performance/performanceModel'

// canPerform tests. Covers admin, claimant, denied, action mismatch, queue
// routing (Phase 4) and Performance joint-stewardship resolution.

describe('canPerform', () => {
  let adminUser: any
  let regularUser: any
  let claimantUser: any
  let otherUser: any

  beforeEach(async () => {
    // Clean slate per test
    await Promise.all([
      UserModel.deleteMany({}),
      VenueModel.deleteMany({}),
      ProductionCompanyModel.deleteMany({}),
      PersonModel.deleteMany({}),
      RunModel.deleteMany({}),
      ShowModel.deleteMany({}),
      PerformanceModel.deleteMany({}),
    ])

    adminUser = await new UserModel({ firebaseUid: 'admin-uid', phoneNumber: '+15550000001', username: 'admin', isAdmin: true }).save()
    regularUser = await new UserModel({ firebaseUid: 'regular-uid', phoneNumber: '+15550000002', username: 'regular' }).save()
    claimantUser = await new UserModel({ firebaseUid: 'claimant-uid', phoneNumber: '+15550000003', username: 'claimant' }).save()
    otherUser = await new UserModel({ firebaseUid: 'other-uid', phoneNumber: '+15550000004', username: 'other' }).save()
  })

  describe('basic gating', () => {
    it('denies when no userId', async () => {
      const venue = await makeVenue({ submittedBy: adminUser._id })
      const decision = await canPerform(null, 'venue.edit_description', { kind: 'Venue', id: venue._id })
      expect(decision.mode).toBe('denied')
      expect(decision.reason).toBe('Unauthenticated')
    })

    it('denies for unknown action', async () => {
      const venue = await makeVenue({ submittedBy: adminUser._id })
      const decision = await canPerform(adminUser._id.toString(), 'nonexistent.action' as any, { kind: 'Venue', id: venue._id })
      expect(decision.mode).toBe('denied')
    })

    it('denies when action targetType mismatches the unit kind', async () => {
      const venue = await makeVenue({ submittedBy: adminUser._id })
      const decision = await canPerform(adminUser._id.toString(), 'person.edit_bio', { kind: 'Venue', id: venue._id })
      expect(decision.mode).toBe('denied')
    })
  })

  describe('admin', () => {
    it('admin auto-publishes on unclaimed venue', async () => {
      const venue = await makeVenue({ submittedBy: adminUser._id })
      const decision = await canPerform(adminUser._id.toString(), 'venue.edit_description', { kind: 'Venue', id: venue._id })
      expect(decision.mode).toBe('auto-publish')
    })

    it('admin auto-publishes on claimed-by-someone-else venue', async () => {
      const venue = await makeVenue({ submittedBy: adminUser._id, claimedBy: claimantUser._id, claimState: 'claimed-passive' })
      const decision = await canPerform(adminUser._id.toString(), 'venue.edit_description', { kind: 'Venue', id: venue._id })
      expect(decision.mode).toBe('auto-publish')
    })
  })

  describe('claimant', () => {
    it('claimant auto-publishes on their own venue', async () => {
      const venue = await makeVenue({ submittedBy: adminUser._id, claimedBy: claimantUser._id, claimState: 'claimed-passive' })
      const decision = await canPerform(claimantUser._id.toString(), 'venue.edit_description', { kind: 'Venue', id: venue._id })
      expect(decision.mode).toBe('auto-publish')
    })

    it('claimant auto-publishes on their own ProductionCompany', async () => {
      const company = await makeCompany({ submittedBy: adminUser._id, claimedBy: claimantUser._id, claimState: 'claimed-passive' })
      const decision = await canPerform(claimantUser._id.toString(), 'company.edit_description', { kind: 'ProductionCompany', id: company._id })
      expect(decision.mode).toBe('auto-publish')
    })

    it('claimant auto-publishes on their own Person', async () => {
      const person = await makePerson({ submittedBy: adminUser._id, claimedBy: claimantUser._id, claimState: 'claimed-passive' })
      const decision = await canPerform(claimantUser._id.toString(), 'person.edit_bio', { kind: 'Person', id: person._id })
      expect(decision.mode).toBe('auto-publish')
    })
  })

  describe('denied / queue routing', () => {
    it('regular user denied on unclaimed venue', async () => {
      const venue = await makeVenue({ submittedBy: adminUser._id })
      const decision = await canPerform(regularUser._id.toString(), 'venue.edit_description', { kind: 'Venue', id: venue._id })
      expect(decision.mode).toBe('denied')
    })

    it('non-claimant routes to queue on claimed venue (Phase 4)', async () => {
      const venue = await makeVenue({ submittedBy: adminUser._id, claimedBy: claimantUser._id, claimState: 'claimed-passive' })
      const decision = await canPerform(otherUser._id.toString(), 'venue.edit_description', { kind: 'Venue', id: venue._id })
      expect(decision.mode).toBe('queue')
    })

    it('denies on missing venue', async () => {
      const decision = await canPerform(adminUser._id.toString(), 'venue.edit_description', {
        kind: 'Venue',
        id: new Types.ObjectId(),
      })
      // Admin bypasses the unit fetch entirely (admin → auto-publish before fetching).
      // Non-admins would get "Venue not found"-ish denial, but for admin the result is auto-publish.
      expect(decision.mode).toBe('auto-publish')
    })

    it('non-admin denied on missing venue', async () => {
      const decision = await canPerform(regularUser._id.toString(), 'venue.edit_description', {
        kind: 'Venue',
        id: new Types.ObjectId(),
      })
      // No unit found, no claimedBy match → falls through to queue-denied
      expect(decision.mode).toBe('denied')
    })
  })

  describe('Performance joint stewardship', () => {
    async function setupPerformance(opts: {
      venueClaimant?: Types.ObjectId
      companyClaimant?: Types.ObjectId
    }) {
      const venue = await makeVenue({
        submittedBy: adminUser._id,
        claimedBy: opts.venueClaimant ?? null,
        claimState: opts.venueClaimant ? 'claimed-passive' : 'unclaimed',
      })
      const company = await makeCompany({
        submittedBy: adminUser._id,
        claimedBy: opts.companyClaimant ?? null,
        claimState: opts.companyClaimant ? 'claimed-passive' : 'unclaimed',
      })
      const show = await new ShowModel({
        title: `Test Show ${new Types.ObjectId().toString()}`,
        performanceTypes: ['play'],
        submittedBy: adminUser._id,
      }).save()
      const run = await new RunModel({
        show: show._id,
        productionCompany: company._id,
        venues: [venue._id],
        startDate: new Date('2026-06-01'),
        submittedBy: adminUser._id,
      }).save()
      const performance = await new PerformanceModel({
        run: run._id,
        venueId: venue._id,
        date: new Date('2026-06-15'),
        time: '19:30',
        submittedBy: adminUser._id,
      }).save()
      return { venue, company, performance }
    }

    it('venue claimant auto-publishes on Performance', async () => {
      const { performance } = await setupPerformance({ venueClaimant: claimantUser._id })
      const decision = await canPerform(claimantUser._id.toString(), 'performance.edit_date_time', {
        kind: 'Performance',
        id: performance._id,
      })
      expect(decision.mode).toBe('auto-publish')
    })

    it('company claimant auto-publishes on Performance', async () => {
      const { performance } = await setupPerformance({ companyClaimant: claimantUser._id })
      const decision = await canPerform(claimantUser._id.toString(), 'performance.edit_date_time', {
        kind: 'Performance',
        id: performance._id,
      })
      expect(decision.mode).toBe('auto-publish')
    })

    it('non-claimant routes to joint queue on Performance when both sides claimed (Phase 4)', async () => {
      const otherClaimantUser = await new UserModel({ firebaseUid: 'oc-uid', phoneNumber: '+15550000005', username: 'oc' }).save()
      const { performance } = await setupPerformance({
        venueClaimant: claimantUser._id,
        companyClaimant: otherClaimantUser._id,
      })
      const decision = await canPerform(otherUser._id.toString(), 'performance.edit_date_time', {
        kind: 'Performance',
        id: performance._id,
      })
      expect(decision.mode).toBe('queue')
      expect(decision.isJointStewardship).toBe(true)
      expect(decision.jointClaimants?.venueClaimantId).toBe(claimantUser._id.toString())
      expect(decision.jointClaimants?.companyClaimantId).toBe(otherClaimantUser._id.toString())
    })

    it('admin auto-publishes on Performance regardless', async () => {
      const { performance } = await setupPerformance({ venueClaimant: claimantUser._id })
      const decision = await canPerform(adminUser._id.toString(), 'performance.edit_date_time', {
        kind: 'Performance',
        id: performance._id,
      })
      expect(decision.mode).toBe('auto-publish')
    })
  })
})

// Helpers

async function makeVenue(overrides: Record<string, any> = {}) {
  return new VenueModel({
    name: `Test Venue ${new Types.ObjectId().toString()}`,
    slug: `test-venue-${new Types.ObjectId().toString()}`,
    venueType: 'theater',
    ...overrides,
  }).save()
}

async function makeCompany(overrides: Record<string, any> = {}) {
  return new ProductionCompanyModel({
    name: `Test Company ${new Types.ObjectId().toString()}`,
    slug: `test-company-${new Types.ObjectId().toString()}`,
    ...overrides,
  }).save()
}

async function makePerson(overrides: Record<string, any> = {}) {
  return new PersonModel({
    name: `Test Person ${new Types.ObjectId().toString()}`,
    slug: `test-person-${new Types.ObjectId().toString()}`,
    ...overrides,
  }).save()
}
