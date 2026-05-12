import { Types } from 'mongoose'
import { UserModel } from '../../../user/userModel'
import { VenueModel } from '../../../venue/venueModel'
import { ProductionCompanyModel } from '../../../productionCompany/productionCompanyModel'
import { PersonModel } from '../../../person/personModel'
import { NotificationModel } from '../../../notification/notificationModel'
import { TrustedEditorModel } from '../../trustedEditorModel'
import { createTrustedEditor } from '../createTrustedEditor'
import { revokeTrustedEditor } from '../revokeTrustedEditor'
import { acceptReciprocity } from '../acceptReciprocity'
import { updateTrustedEditorScope } from '../updateTrustedEditorScope'
import { canPerform } from '../../../../permissions/canPerform'

// Phase 5 — TrustedEditor mutations + canPerform integration. Same direct-
// resolver pattern as Phase 4 specs.
async function callMutation(mutation: any, input: any, ctx: any) {
  return mutation.resolve(null, { input }, ctx, null)
}

describe('TrustedEditor (Phase 5)', () => {
  let adminUser: any
  let venueClaimant: any   // claimant of Atlantic
  let companyClaimant: any // claimant of Civilians
  let proposerUser: any    // a regular user (Bob)
  let outsiderUser: any
  let managerOfCivilians: any
  let publicistOfCivilians: any

  beforeEach(async () => {
    await Promise.all([
      UserModel.deleteMany({}),
      VenueModel.deleteMany({}),
      ProductionCompanyModel.deleteMany({}),
      PersonModel.deleteMany({}),
      NotificationModel.deleteMany({}),
      TrustedEditorModel.deleteMany({}),
    ])
    adminUser = await new UserModel({ firebaseUid: 'admin-5', phoneNumber: '+15550005001', username: 'admin', isAdmin: true }).save()
    venueClaimant = await new UserModel({ firebaseUid: 'vc-5', phoneNumber: '+15550005002', username: 'alice' }).save()
    companyClaimant = await new UserModel({ firebaseUid: 'cc-5', phoneNumber: '+15550005003', username: 'bob' }).save()
    proposerUser = await new UserModel({ firebaseUid: 'pu-5', phoneNumber: '+15550005004', username: 'carol' }).save()
    outsiderUser = await new UserModel({ firebaseUid: 'out-5', phoneNumber: '+15550005005', username: 'eve' }).save()
    managerOfCivilians = await new UserModel({ firebaseUid: 'mgr-5', phoneNumber: '+15550005006', username: 'mgr' }).save()
    publicistOfCivilians = await new UserModel({ firebaseUid: 'pub-5', phoneNumber: '+15550005007', username: 'pub' }).save()
  })

  async function makeClaimedVenue(overrides: Record<string, any> = {}) {
    return new VenueModel({
      name: 'Atlantic Theater',
      slug: `atlantic-${new Types.ObjectId().toString()}`,
      venueType: 'theater',
      submittedBy: adminUser._id,
      claimedBy: venueClaimant._id,
      claimState: 'claimed-passive',
      ...overrides,
    }).save()
  }

  async function makeClaimedCompany(overrides: Record<string, any> = {}) {
    return new ProductionCompanyModel({
      name: 'Civilians',
      slug: `civilians-${new Types.ObjectId().toString()}`,
      submittedBy: adminUser._id,
      claimedBy: companyClaimant._id,
      claimState: 'claimed-passive',
      ...overrides,
    }).save()
  }

  describe('createTrustedEditor', () => {
    it('claimant can grant trust to a User', async () => {
      const venue = await makeClaimedVenue()
      const result = await callMutation(createTrustedEditor, {
        grantedOnKind: 'Venue',
        grantedOnId: venue._id.toString(),
        recipientKind: 'User',
        recipientId: proposerUser._id.toString(),
        roleTemplate: 'Publicist',
      }, { user: { id: venueClaimant._id.toString() } })

      expect(result.error).toBeUndefined()
      expect(result.trustedEditor).toBeTruthy()
      expect(result.trustedEditor.roleTemplate).toBe('Publicist')
      expect(result.trustedEditor.scope).toContain('venue.edit_description')

      const notif = await NotificationModel.findOne({
        recipient: proposerUser._id,
        kind: 'trust_granted',
      })
      expect(notif).toBeTruthy()
    })

    it('admin can grant trust on any unit', async () => {
      const venue = await makeClaimedVenue()
      const result = await callMutation(createTrustedEditor, {
        grantedOnKind: 'Venue',
        grantedOnId: venue._id.toString(),
        recipientKind: 'User',
        recipientId: proposerUser._id.toString(),
        roleTemplate: 'Manager',
      }, { user: { id: adminUser._id.toString() } })

      expect(result.error).toBeUndefined()
      expect(result.trustedEditor.roleTemplate).toBe('Manager')
    })

    it('non-claimant non-admin denied', async () => {
      const venue = await makeClaimedVenue()
      const result = await callMutation(createTrustedEditor, {
        grantedOnKind: 'Venue',
        grantedOnId: venue._id.toString(),
        recipientKind: 'User',
        recipientId: proposerUser._id.toString(),
        roleTemplate: 'Publicist',
      }, { user: { id: outsiderUser._id.toString() } })
      expect(result.error).toMatch(/claimant/i)
    })

    it('explicit scope overrides template default', async () => {
      const venue = await makeClaimedVenue()
      const result = await callMutation(createTrustedEditor, {
        grantedOnKind: 'Venue',
        grantedOnId: venue._id.toString(),
        recipientKind: 'User',
        recipientId: proposerUser._id.toString(),
        roleTemplate: 'Custom',
        scope: ['venue.edit_description'],
      }, { user: { id: venueClaimant._id.toString() } })
      expect(result.error).toBeUndefined()
      expect(result.trustedEditor.scope).toEqual(['venue.edit_description'])
    })

    it('unit-to-unit grant fires reciprocity_offered to recipient claimant', async () => {
      const venue = await makeClaimedVenue()
      const company = await makeClaimedCompany()
      const result = await callMutation(createTrustedEditor, {
        grantedOnKind: 'Venue',
        grantedOnId: venue._id.toString(),
        recipientKind: 'ProductionCompany',
        recipientId: company._id.toString(),
        roleTemplate: 'Manager',
      }, { user: { id: venueClaimant._id.toString() } })

      expect(result.error).toBeUndefined()

      const granted = await NotificationModel.findOne({
        recipient: companyClaimant._id,
        kind: 'trust_granted',
      })
      expect(granted).toBeTruthy()
      const recipOffer = await NotificationModel.findOne({
        recipient: companyClaimant._id,
        kind: 'reciprocity_offered',
      })
      expect(recipOffer).toBeTruthy()
    })

    it('rejects unknown action ids in scope', async () => {
      const venue = await makeClaimedVenue()
      const result = await callMutation(createTrustedEditor, {
        grantedOnKind: 'Venue',
        grantedOnId: venue._id.toString(),
        recipientKind: 'User',
        recipientId: proposerUser._id.toString(),
        roleTemplate: 'Custom',
        scope: ['venue.lol_made_up'],
      }, { user: { id: venueClaimant._id.toString() } })
      expect(result.error).toMatch(/Unknown actions/i)
    })

    it('refuses duplicate active grant', async () => {
      const venue = await makeClaimedVenue()
      await callMutation(createTrustedEditor, {
        grantedOnKind: 'Venue',
        grantedOnId: venue._id.toString(),
        recipientKind: 'User',
        recipientId: proposerUser._id.toString(),
        roleTemplate: 'Publicist',
      }, { user: { id: venueClaimant._id.toString() } })
      const dup = await callMutation(createTrustedEditor, {
        grantedOnKind: 'Venue',
        grantedOnId: venue._id.toString(),
        recipientKind: 'User',
        recipientId: proposerUser._id.toString(),
        roleTemplate: 'Publicist',
      }, { user: { id: venueClaimant._id.toString() } })
      expect(dup.error).toMatch(/already exists/i)
    })
  })

  describe('canPerform — direct user grant', () => {
    it('grant within scope → auto-publish', async () => {
      const venue = await makeClaimedVenue()
      await callMutation(createTrustedEditor, {
        grantedOnKind: 'Venue',
        grantedOnId: venue._id.toString(),
        recipientKind: 'User',
        recipientId: proposerUser._id.toString(),
        roleTemplate: 'Publicist',
      }, { user: { id: venueClaimant._id.toString() } })

      const decision = await canPerform(
        proposerUser._id.toString(),
        'venue.edit_description',
        { kind: 'Venue', id: venue._id },
      )
      expect(decision.mode).toBe('auto-publish')
      expect(decision.trustSource).toBe('direct-grant')
    })

    it('out-of-scope action → queue (existing behavior)', async () => {
      const venue = await makeClaimedVenue()
      // Publicist does NOT include venue.edit_name
      await callMutation(createTrustedEditor, {
        grantedOnKind: 'Venue',
        grantedOnId: venue._id.toString(),
        recipientKind: 'User',
        recipientId: proposerUser._id.toString(),
        roleTemplate: 'Publicist',
      }, { user: { id: venueClaimant._id.toString() } })

      const decision = await canPerform(
        proposerUser._id.toString(),
        'venue.edit_name',
        { kind: 'Venue', id: venue._id },
      )
      expect(decision.mode).toBe('queue')
    })

    it('revoked grant ignored — falls back to queue', async () => {
      const venue = await makeClaimedVenue()
      const grant = await callMutation(createTrustedEditor, {
        grantedOnKind: 'Venue',
        grantedOnId: venue._id.toString(),
        recipientKind: 'User',
        recipientId: proposerUser._id.toString(),
        roleTemplate: 'Publicist',
      }, { user: { id: venueClaimant._id.toString() } })

      const revokeResult = await callMutation(revokeTrustedEditor, {
        trustedEditorId: grant.trustedEditor._id.toString(),
      }, { user: { id: venueClaimant._id.toString() } })
      expect(revokeResult.error).toBeUndefined()

      const decision = await canPerform(
        proposerUser._id.toString(),
        'venue.edit_description',
        { kind: 'Venue', id: venue._id },
      )
      expect(decision.mode).toBe('queue')
    })
  })

  describe('canPerform — 1-hop cascade', () => {
    it('Manager-scope editor of recipient unit cascades onto granted unit', async () => {
      const venue = await makeClaimedVenue()        // claimed by venueClaimant
      const company = await makeClaimedCompany()    // claimed by companyClaimant

      // Atlantic grants trust to Civilians (unit-to-unit, Manager scope so the
      // venue.edit_description action is in scope on the cascade)
      await callMutation(createTrustedEditor, {
        grantedOnKind: 'Venue',
        grantedOnId: venue._id.toString(),
        recipientKind: 'ProductionCompany',
        recipientId: company._id.toString(),
        roleTemplate: 'Manager',
      }, { user: { id: venueClaimant._id.toString() } })

      // Carol is a Manager-scope trusted editor of Civilians
      await callMutation(createTrustedEditor, {
        grantedOnKind: 'ProductionCompany',
        grantedOnId: company._id.toString(),
        recipientKind: 'User',
        recipientId: managerOfCivilians._id.toString(),
        roleTemplate: 'Manager',
      }, { user: { id: companyClaimant._id.toString() } })

      const decision = await canPerform(
        managerOfCivilians._id.toString(),
        'venue.edit_description',
        { kind: 'Venue', id: venue._id },
      )
      expect(decision.mode).toBe('auto-publish')
      expect(decision.trustSource).toBe('cascade')
    })

    it('claimant of recipient unit also cascades onto granted unit', async () => {
      const venue = await makeClaimedVenue()
      const company = await makeClaimedCompany()
      await callMutation(createTrustedEditor, {
        grantedOnKind: 'Venue',
        grantedOnId: venue._id.toString(),
        recipientKind: 'ProductionCompany',
        recipientId: company._id.toString(),
        roleTemplate: 'Manager',
      }, { user: { id: venueClaimant._id.toString() } })

      const decision = await canPerform(
        companyClaimant._id.toString(),
        'venue.edit_description',
        { kind: 'Venue', id: venue._id },
      )
      expect(decision.mode).toBe('auto-publish')
      expect(decision.trustSource).toBe('cascade')
    })

    it('Publicist-scope (non-Manager) editor of recipient unit does NOT cascade', async () => {
      const venue = await makeClaimedVenue()
      const company = await makeClaimedCompany()
      await callMutation(createTrustedEditor, {
        grantedOnKind: 'Venue',
        grantedOnId: venue._id.toString(),
        recipientKind: 'ProductionCompany',
        recipientId: company._id.toString(),
        roleTemplate: 'Manager',
      }, { user: { id: venueClaimant._id.toString() } })

      // Publicist of Civilians — does NOT cascade per design (only Manager scope cascades)
      await callMutation(createTrustedEditor, {
        grantedOnKind: 'ProductionCompany',
        grantedOnId: company._id.toString(),
        recipientKind: 'User',
        recipientId: publicistOfCivilians._id.toString(),
        roleTemplate: 'Publicist',
      }, { user: { id: companyClaimant._id.toString() } })

      const decision = await canPerform(
        publicistOfCivilians._id.toString(),
        'venue.edit_description',
        { kind: 'Venue', id: venue._id },
      )
      expect(decision.mode).toBe('queue')
    })

    it('cascade does not extend to actions outside the unit-grant scope', async () => {
      const venue = await makeClaimedVenue()
      const company = await makeClaimedCompany()
      // Grant Civilians a Publicist scope on Atlantic — does NOT include venue.edit_name
      await callMutation(createTrustedEditor, {
        grantedOnKind: 'Venue',
        grantedOnId: venue._id.toString(),
        recipientKind: 'ProductionCompany',
        recipientId: company._id.toString(),
        roleTemplate: 'Publicist',
      }, { user: { id: venueClaimant._id.toString() } })

      // Carol is Manager of Civilians, but the cascade scope on Atlantic is Publicist
      await callMutation(createTrustedEditor, {
        grantedOnKind: 'ProductionCompany',
        grantedOnId: company._id.toString(),
        recipientKind: 'User',
        recipientId: managerOfCivilians._id.toString(),
        roleTemplate: 'Manager',
      }, { user: { id: companyClaimant._id.toString() } })

      // venue.edit_description IS in Publicist → cascade allows
      const allow = await canPerform(
        managerOfCivilians._id.toString(),
        'venue.edit_description',
        { kind: 'Venue', id: venue._id },
      )
      expect(allow.mode).toBe('auto-publish')

      // venue.edit_name is NOT in Publicist → falls through to queue
      const deny = await canPerform(
        managerOfCivilians._id.toString(),
        'venue.edit_name',
        { kind: 'Venue', id: venue._id },
      )
      expect(deny.mode).toBe('queue')
    })
  })

  describe('revokeTrustedEditor', () => {
    it('grantor can revoke; recipient gets a trust_revoked notification', async () => {
      const venue = await makeClaimedVenue()
      const grant = await callMutation(createTrustedEditor, {
        grantedOnKind: 'Venue',
        grantedOnId: venue._id.toString(),
        recipientKind: 'User',
        recipientId: proposerUser._id.toString(),
        roleTemplate: 'Publicist',
      }, { user: { id: venueClaimant._id.toString() } })

      const result = await callMutation(revokeTrustedEditor, {
        trustedEditorId: grant.trustedEditor._id.toString(),
      }, { user: { id: venueClaimant._id.toString() } })
      expect(result.error).toBeUndefined()
      expect(result.trustedEditor.revokedAt).toBeTruthy()

      const notif = await NotificationModel.findOne({
        recipient: proposerUser._id,
        kind: 'trust_revoked',
      })
      expect(notif).toBeTruthy()
    })

    it('non-grantor non-admin denied', async () => {
      const venue = await makeClaimedVenue()
      const grant = await callMutation(createTrustedEditor, {
        grantedOnKind: 'Venue',
        grantedOnId: venue._id.toString(),
        recipientKind: 'User',
        recipientId: proposerUser._id.toString(),
        roleTemplate: 'Publicist',
      }, { user: { id: venueClaimant._id.toString() } })

      const result = await callMutation(revokeTrustedEditor, {
        trustedEditorId: grant.trustedEditor._id.toString(),
      }, { user: { id: outsiderUser._id.toString() } })
      expect(result.error).toMatch(/grantor|admin|claimant/i)
    })
  })

  describe('acceptReciprocity', () => {
    it('creates the reverse grant with Manager scope', async () => {
      const venue = await makeClaimedVenue()
      const company = await makeClaimedCompany()

      const original = await callMutation(createTrustedEditor, {
        grantedOnKind: 'Venue',
        grantedOnId: venue._id.toString(),
        recipientKind: 'ProductionCompany',
        recipientId: company._id.toString(),
        roleTemplate: 'Manager',
      }, { user: { id: venueClaimant._id.toString() } })

      const result = await callMutation(acceptReciprocity, {
        originalTrustedEditorId: original.trustedEditor._id.toString(),
      }, { user: { id: companyClaimant._id.toString() } })

      expect(result.error).toBeUndefined()
      expect(result.trustedEditor.roleTemplate).toBe('Manager')
      expect(result.trustedEditor.grantedOn.kind).toBe('ProductionCompany')
      expect(result.trustedEditor.recipient.kind).toBe('Venue')

      // Now venueClaimant can edit on Civilians via the cascade (claimant of grantedOn)
      const decision = await canPerform(
        venueClaimant._id.toString(),
        'company.edit_description',
        { kind: 'ProductionCompany', id: company._id },
      )
      expect(decision.mode).toBe('auto-publish')
    })

    it('only the claimant of the recipient unit can accept', async () => {
      const venue = await makeClaimedVenue()
      const company = await makeClaimedCompany()
      const original = await callMutation(createTrustedEditor, {
        grantedOnKind: 'Venue',
        grantedOnId: venue._id.toString(),
        recipientKind: 'ProductionCompany',
        recipientId: company._id.toString(),
        roleTemplate: 'Manager',
      }, { user: { id: venueClaimant._id.toString() } })

      const result = await callMutation(acceptReciprocity, {
        originalTrustedEditorId: original.trustedEditor._id.toString(),
      }, { user: { id: outsiderUser._id.toString() } })
      expect(result.error).toMatch(/claimant/i)
    })
  })

  describe('updateTrustedEditorScope', () => {
    it('grantor can update the scope', async () => {
      const venue = await makeClaimedVenue()
      const grant = await callMutation(createTrustedEditor, {
        grantedOnKind: 'Venue',
        grantedOnId: venue._id.toString(),
        recipientKind: 'User',
        recipientId: proposerUser._id.toString(),
        roleTemplate: 'Publicist',
      }, { user: { id: venueClaimant._id.toString() } })

      const result = await callMutation(updateTrustedEditorScope, {
        trustedEditorId: grant.trustedEditor._id.toString(),
        scope: ['venue.edit_description', 'venue.edit_name'],
        roleTemplate: 'Custom',
      }, { user: { id: venueClaimant._id.toString() } })
      expect(result.error).toBeUndefined()
      expect(result.trustedEditor.scope).toEqual(['venue.edit_description', 'venue.edit_name'])
      expect(result.trustedEditor.roleTemplate).toBe('Custom')
    })
  })
})
