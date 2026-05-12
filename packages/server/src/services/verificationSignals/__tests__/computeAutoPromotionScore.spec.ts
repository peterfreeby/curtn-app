import { Types } from 'mongoose'

// IMPORTANT: jest.mock calls are hoisted above imports by Jest. We mock the
// service modules so tests can drive verifyWebmasterToken /
// validateExternalProfile without hitting the network.
jest.mock('../webmasterVerification', () => {
  const actual = jest.requireActual('../webmasterVerification')
  return { ...actual, verifyWebmasterToken: jest.fn(actual.verifyWebmasterToken) }
})
jest.mock('../externalProfileValidator', () => {
  const actual = jest.requireActual('../externalProfileValidator')
  return { ...actual, validateExternalProfile: jest.fn(actual.validateExternalProfile) }
})

import { UserModel } from '../../../entities/user/userModel'
import { VenueModel } from '../../../entities/venue/venueModel'
import { PersonModel } from '../../../entities/person/personModel'
import { ClaimRequestModel } from '../../../entities/claimRequest/claimRequestModel'
import { NotificationModel } from '../../../entities/notification/notificationModel'
import { AuditLogModel } from '../../../entities/auditLog/auditLogModel'
import { TrustedEditorModel } from '../../../entities/trustedEditor/trustedEditorModel'
import { submitClaim } from '../../../entities/claimRequest/mutations/submitClaim'
import { verifyWebmasterMutation } from '../../../entities/claimRequest/mutations/verifyWebmaster'
import { generateWebmasterTokenMutation } from '../../../entities/claimRequest/mutations/generateWebmasterToken'
import { linkExternalProfileMutation } from '../../../entities/claimRequest/mutations/linkExternalProfile'
import { computeAutoPromotionScore } from '../computeAutoPromotionScore'
import { computeTrustGraphEndorsements } from '../computeTrustGraphEndorsements'
import { maybeAutoPromote } from '../maybeAutoPromote'
import { verifyWebmasterToken, extractCurtnVerifyMeta } from '../webmasterVerification'
import { validateExternalProfile } from '../externalProfileValidator'
import { SIGNAL_POINTS } from '../../../permissions/verificationSignals'

const mockedVerifyWebmasterToken = verifyWebmasterToken as unknown as jest.Mock
const mockedValidateExternalProfile = validateExternalProfile as unknown as jest.Mock

// Phase 8 — verification signals end-to-end.

async function callMutation(mutation: any, input: any, ctx: any) {
  return mutation.resolve(null, { input }, ctx)
}

describe('Verification signals (Phase 8)', () => {
  let adminUser: any
  let claimantUser: any
  let venue: any

  beforeEach(async () => {
    await Promise.all([
      UserModel.deleteMany({}),
      VenueModel.deleteMany({}),
      PersonModel.deleteMany({}),
      ClaimRequestModel.deleteMany({}),
      NotificationModel.deleteMany({}),
      AuditLogModel.deleteMany({}),
      TrustedEditorModel.deleteMany({}),
    ])

    adminUser = await new UserModel({
      firebaseUid: 'admin-uid', phoneNumber: '+15550000001', username: 'admin', isAdmin: true,
    }).save()
    claimantUser = await new UserModel({
      firebaseUid: 'claimant-uid', phoneNumber: '+15550000002', username: 'alice',
    }).save()

    venue = await new VenueModel({
      name: 'Test Venue',
      slug: `test-venue-${new Types.ObjectId().toString()}`,
      venueType: 'theater',
      website: 'https://example.com',
      submittedBy: adminUser._id,
    }).save()
  })

  describe('computeAutoPromotionScore', () => {
    it('returns 0 for a fresh claim with no signals', async () => {
      const claim = await new ClaimRequestModel({
        user: claimantUser._id,
        target: { kind: 'venue', id: venue._id },
        message: '',
        signals: { externalProfileLinks: [], trustGraphEndorsements: [] },
      }).save()
      const breakdown = await computeAutoPromotionScore(claim)
      expect(breakdown.total).toBe(0)
    })

    it('awards 100 points for webmasterVerified — sufficient alone', async () => {
      const claim = await new ClaimRequestModel({
        user: claimantUser._id,
        target: { kind: 'venue', id: venue._id },
        message: '',
        signals: {
          webmasterVerified: true,
          externalProfileLinks: [],
          trustGraphEndorsements: [],
        },
      }).save()
      const breakdown = await computeAutoPromotionScore(claim)
      expect(breakdown.webmasterVerified).toBe(SIGNAL_POINTS.WEBMASTER_VERIFIED)
      expect(breakdown.total).toBeGreaterThanOrEqual(SIGNAL_POINTS.AUTO_PROMOTE_THRESHOLD)
    })

    it('caps external-profile-link points at the class cap', async () => {
      const links = Array.from({ length: 5 }).map(() => ({
        url: `https://www.wikidata.org/wiki/Q${Math.floor(Math.random() * 1e6)}`,
        platform: 'wikidata' as const,
        verifiedAt: new Date(),
      }))
      const claim = await new ClaimRequestModel({
        user: claimantUser._id,
        target: { kind: 'venue', id: venue._id },
        message: '',
        signals: {
          externalProfileLinks: links,
          trustGraphEndorsements: [],
        },
      }).save()
      const breakdown = await computeAutoPromotionScore(claim)
      expect(breakdown.externalProfiles).toBe(SIGNAL_POINTS.EXTERNAL_PROFILE_LINKED_CAP)
    })

    it('awards trust-graph endorsement points up to cap', async () => {
      const endorsements = Array.from({ length: 4 }).map(() => ({
        grantingUnit: { kind: 'Venue', id: new Types.ObjectId() },
        grantedAt: new Date(),
      }))
      const claim = await new ClaimRequestModel({
        user: claimantUser._id,
        target: { kind: 'venue', id: venue._id },
        message: '',
        signals: {
          externalProfileLinks: [],
          trustGraphEndorsements: endorsements,
        },
      }).save()
      const breakdown = await computeAutoPromotionScore(claim)
      expect(breakdown.trustGraph).toBe(SIGNAL_POINTS.TRUST_GRAPH_ENDORSEMENT_CAP)
    })

    it('awards prior-approved-claim signal only when user has a prior approved claim', async () => {
      // Approved claim on a different venue
      await new ClaimRequestModel({
        user: claimantUser._id,
        target: { kind: 'venue', id: new Types.ObjectId() },
        status: 'approved',
        signals: { externalProfileLinks: [], trustGraphEndorsements: [] },
      }).save()
      const claim = await new ClaimRequestModel({
        user: claimantUser._id,
        target: { kind: 'venue', id: venue._id },
        message: '',
        signals: { externalProfileLinks: [], trustGraphEndorsements: [] },
      }).save()
      const breakdown = await computeAutoPromotionScore(claim)
      expect(breakdown.priorApprovedClaim).toBe(SIGNAL_POINTS.PRIOR_APPROVED_CLAIM)
    })

    it('SAME_EMAIL_DOMAIN_AS_WEBSITE is 0 in v1 (no email on User)', () => {
      // Constant catalog check.
      expect(SIGNAL_POINTS.SAME_EMAIL_DOMAIN_AS_WEBSITE).toBe(0)
    })

    it('evidence text quality contributes within cap', async () => {
      const claim = await new ClaimRequestModel({
        user: claimantUser._id,
        target: { kind: 'venue', id: venue._id },
        message: 'I am the founder and artistic director of this theater. I have been running it for ten years.',
        signals: { externalProfileLinks: [], trustGraphEndorsements: [] },
      }).save()
      const breakdown = await computeAutoPromotionScore(claim)
      expect(breakdown.evidenceTextQuality).toBeGreaterThan(0)
      expect(breakdown.evidenceTextQuality).toBeLessThanOrEqual(SIGNAL_POINTS.EVIDENCE_TEXT_QUALITY_MAX)
    })
  })

  describe('computeTrustGraphEndorsements', () => {
    it('returns endorsements from claimed units granted by other users', async () => {
      const granterUser = await new UserModel({
        firebaseUid: 'granter-uid', phoneNumber: '+15550000099', username: 'granter',
      }).save()
      const grantingVenue = await new VenueModel({
        name: 'Granting Venue',
        slug: `granter-${new Types.ObjectId().toString()}`,
        venueType: 'theater',
        submittedBy: adminUser._id,
        claimState: 'claimed-passive',
        claimedBy: granterUser._id,
      }).save()
      await new TrustedEditorModel({
        grantedOn: { kind: 'Venue', id: grantingVenue._id },
        recipient: { kind: 'User', id: claimantUser._id },
        scope: ['*'],
        roleTemplate: 'Manager',
        grantedBy: granterUser._id,
        grantedAt: new Date(),
      }).save()
      const endorsements = await computeTrustGraphEndorsements(claimantUser._id)
      expect(endorsements).toHaveLength(1)
      expect(endorsements[0].grantingUnit.kind).toBe('Venue')
    })

    it('ignores grants from unclaimed/provisionally-claimed units', async () => {
      const grantingVenue = await new VenueModel({
        name: 'Unclaimed Venue',
        slug: `unclaim-${new Types.ObjectId().toString()}`,
        venueType: 'theater',
        submittedBy: adminUser._id,
        claimState: 'unclaimed',
      }).save()
      await new TrustedEditorModel({
        grantedOn: { kind: 'Venue', id: grantingVenue._id },
        recipient: { kind: 'User', id: claimantUser._id },
        scope: ['*'],
        roleTemplate: 'Manager',
        grantedBy: adminUser._id,
        grantedAt: new Date(),
      }).save()
      const endorsements = await computeTrustGraphEndorsements(claimantUser._id)
      expect(endorsements).toHaveLength(0)
    })

    it('does not count self-cycle grants (granter and recipient are the same user)', async () => {
      const otherVenue = await new VenueModel({
        name: 'Self-claimed Venue',
        slug: `self-${new Types.ObjectId().toString()}`,
        venueType: 'theater',
        submittedBy: adminUser._id,
        claimState: 'claimed-passive',
        claimedBy: claimantUser._id,
      }).save()
      await new TrustedEditorModel({
        grantedOn: { kind: 'Venue', id: otherVenue._id },
        recipient: { kind: 'User', id: claimantUser._id },
        scope: ['*'],
        roleTemplate: 'Manager',
        grantedBy: claimantUser._id,
        grantedAt: new Date(),
      }).save()
      const endorsements = await computeTrustGraphEndorsements(claimantUser._id)
      expect(endorsements).toHaveLength(0)
    })
  })

  describe('webmaster verification end-to-end', () => {
    beforeEach(() => {
      mockedVerifyWebmasterToken.mockReset()
    })

    it('verifies via meta tag and auto-promotes (100 pts → threshold)', async () => {
      const submitRes = await callMutation(submitClaim, {
        targetKind: 'venue',
        targetId: venue._id.toString(),
        evidence: 'hi',
      }, { user: { id: claimantUser._id.toString() } })
      const claimId = submitRes.claimRequest._id

      const tokenRes = await callMutation(generateWebmasterTokenMutation, {
        claimRequestId: claimId.toString(),
      }, { user: { id: claimantUser._id.toString() } })
      expect(tokenRes.token).toBeTruthy()

      mockedVerifyWebmasterToken.mockResolvedValue({ verified: true, method: 'meta' })

      const verifyRes = await callMutation(verifyWebmasterMutation, {
        claimRequestId: claimId.toString(),
      }, { user: { id: claimantUser._id.toString() } })
      expect(verifyRes.verified).toBe(true)
      expect(verifyRes.autoPromoted).toBe(true)

      const refreshedVenue = await VenueModel.findById(venue._id)
      expect(refreshedVenue!.claimState).toBe('claimed-passive')
      expect(refreshedVenue!.claimedBy?.toString()).toBe(claimantUser._id.toString())

      const auditEntries = await AuditLogModel.find({ 'target.id': venue._id })
      expect(auditEntries.length).toBeGreaterThanOrEqual(1)
      const sys = auditEntries.find((a) => a.author.kind === 'System')
      expect(sys).toBeTruthy()
      expect(sys!.author.label).toContain('Auto-approved')
    })

    it('fires webmaster_verification_failed notification on failure path', async () => {
      const submitRes = await callMutation(submitClaim, {
        targetKind: 'venue',
        targetId: venue._id.toString(),
        evidence: 'hi',
      }, { user: { id: claimantUser._id.toString() } })
      const claimId = submitRes.claimRequest._id

      await callMutation(generateWebmasterTokenMutation, {
        claimRequestId: claimId.toString(),
      }, { user: { id: claimantUser._id.toString() } })

      mockedVerifyWebmasterToken.mockResolvedValue({ verified: false, error: 'tag not found' })

      const verifyRes = await callMutation(verifyWebmasterMutation, {
        claimRequestId: claimId.toString(),
      }, { user: { id: claimantUser._id.toString() } })
      expect(verifyRes.verified).toBe(false)

      const failNote = await NotificationModel.findOne({
        recipient: claimantUser._id,
        kind: 'webmaster_verification_failed',
      })
      expect(failNote).toBeTruthy()
    })
  })

  describe('external profile linking', () => {
    beforeEach(() => {
      mockedValidateExternalProfile.mockReset()
    })

    it('links a Wikidata profile after name-match cross-check', async () => {
      const person = await new PersonModel({
        name: 'Stephen Sondheim',
        slug: `sondheim-${new Types.ObjectId().toString()}`,
        submittedBy: adminUser._id,
      }).save()

      const submitRes = await callMutation(submitClaim, {
        targetKind: 'person',
        targetId: person._id.toString(),
        evidence: 'hi',
      }, { user: { id: claimantUser._id.toString() } })
      const claimId = submitRes.claimRequest._id

      mockedValidateExternalProfile.mockResolvedValue({
        ok: true,
        platform: 'wikidata',
        wikidataId: 'Q193670',
      })

      const linkRes = await callMutation(linkExternalProfileMutation, {
        claimRequestId: claimId.toString(),
        url: 'https://www.wikidata.org/wiki/Q193670',
        platform: 'wikidata',
      }, { user: { id: claimantUser._id.toString() } })
      expect(linkRes.error).toBeFalsy()
      const refreshed = await ClaimRequestModel.findById(claimId)
      expect(refreshed!.signals.externalProfileLinks).toHaveLength(1)
      expect(refreshed!.signals.externalProfileLinks[0].platform).toBe('wikidata')
    })

    it('rejects a Wikidata link when name does not match (mismatch path)', async () => {
      const person = await new PersonModel({
        name: 'Jane Doe',
        slug: `jane-${new Types.ObjectId().toString()}`,
        submittedBy: adminUser._id,
      }).save()

      const submitRes = await callMutation(submitClaim, {
        targetKind: 'person',
        targetId: person._id.toString(),
        evidence: 'hi',
      }, { user: { id: claimantUser._id.toString() } })
      const claimId = submitRes.claimRequest._id

      mockedValidateExternalProfile.mockResolvedValue({
        ok: false,
        platform: 'wikidata',
        wikidataId: 'Q193670',
        error: 'Wikidata entry Q193670 ("Stephen Sondheim") doesn\'t match the claimed person name "Jane Doe"',
      })

      const linkRes = await callMutation(linkExternalProfileMutation, {
        claimRequestId: claimId.toString(),
        url: 'https://www.wikidata.org/wiki/Q193670',
        platform: 'wikidata',
      }, { user: { id: claimantUser._id.toString() } })
      expect(linkRes.error).toMatch(/doesn't match/i)
    })
  })

  describe('auto-promotion threshold', () => {
    it('auto-promotes at exactly 100 points', async () => {
      const claim = await new ClaimRequestModel({
        user: claimantUser._id,
        target: { kind: 'venue', id: venue._id },
        message: '',
        signals: {
          webmasterVerified: true,
          externalProfileLinks: [],
          trustGraphEndorsements: [],
        },
      }).save()
      const result = await maybeAutoPromote(claim as any)
      expect(result.promoted).toBe(true)
      expect(result.score).toBeGreaterThanOrEqual(SIGNAL_POINTS.AUTO_PROMOTE_THRESHOLD)
    })

    it('does not auto-promote at 99 points (just under threshold)', async () => {
      // Build a claim with 75 + 15 = 90 pts. Below threshold.
      const claim = await new ClaimRequestModel({
        user: claimantUser._id,
        target: { kind: 'venue', id: venue._id },
        message: 'I am the founder, director, and manager of this venue. I have run it for many years.',
        signals: {
          externalProfileLinks: [
            { url: 'https://www.wikidata.org/wiki/Q1', platform: 'wikidata', verifiedAt: new Date() },
            { url: 'https://www.wikidata.org/wiki/Q2', platform: 'wikidata', verifiedAt: new Date() },
            { url: 'https://www.wikidata.org/wiki/Q3', platform: 'wikidata', verifiedAt: new Date() },
          ],
          trustGraphEndorsements: [],
        },
      }).save()
      const result = await maybeAutoPromote(claim as any)
      expect(result.promoted).toBe(false)
      expect(result.score).toBeLessThan(SIGNAL_POINTS.AUTO_PROMOTE_THRESHOLD)
      // Unit should remain unclaimed/provisionally-claimed.
      const refreshed = await VenueModel.findById(venue._id)
      expect(['unclaimed', 'provisionally-claimed']).toContain(refreshed!.claimState)
    })
  })

  describe('extractCurtnVerifyMeta', () => {
    it('finds the token in a name-first meta tag', () => {
      const html = `<html><head><meta name="curtn-verify" content="abc123"></head></html>`
      expect(extractCurtnVerifyMeta(html)).toBe('abc123')
    })
    it('finds the token in a content-first meta tag', () => {
      const html = `<html><head><meta content="xyz789" name="curtn-verify"></head></html>`
      expect(extractCurtnVerifyMeta(html)).toBe('xyz789')
    })
    it('returns null when missing', () => {
      const html = `<html><head><title>nope</title></head></html>`
      expect(extractCurtnVerifyMeta(html)).toBeNull()
    })
  })
})
