import { Types } from 'mongoose'
import { TrustedEditorModel } from '../../entities/trustedEditor/trustedEditorModel'
import { VenueModel } from '../../entities/venue/venueModel'
import { ProductionCompanyModel } from '../../entities/productionCompany/productionCompanyModel'
import { PersonModel } from '../../entities/person/personModel'

// Phase 8 — Trust-graph signal computer.
//
// A provisional claimant's claim is endorsed when they hold Manager-scope
// TrustedEditor grants from claimed units that are themselves in a
// verified-claim state (`claimed-passive` or `claimed-synced`). Each
// qualifying grant adds 25 points to the auto-promotion score (capped at 75).
//
// We only count active (non-revoked) grants from another distinct user — to
// prevent self-cycle gaming, the granter's claimant must not be the same
// user as the recipient.

export interface TrustGraphEndorsement {
  grantingUnit: { kind: string; id: Types.ObjectId }
  grantedAt: Date
}

const VERIFIED_STATES = ['claimed-passive', 'claimed-synced']

async function getClaimantId(kind: string, id: Types.ObjectId): Promise<Types.ObjectId | null> {
  let doc: any = null
  if (kind === 'Venue') doc = await VenueModel.findById(id).select('claimedBy claimState').lean()
  else if (kind === 'ProductionCompany') doc = await ProductionCompanyModel.findById(id).select('claimedBy claimState').lean()
  else if (kind === 'Person') doc = await PersonModel.findById(id).select('claimedBy claimState').lean()
  if (!doc) return null
  if (!VERIFIED_STATES.includes(doc.claimState)) return null
  return doc.claimedBy ?? null
}

export async function computeTrustGraphEndorsements(
  userId: Types.ObjectId | string
): Promise<TrustGraphEndorsement[]> {
  const uid = typeof userId === 'string' ? new Types.ObjectId(userId) : userId

  // Active Manager-scope grants whose recipient is this user.
  const grants = await TrustedEditorModel.find({
    'recipient.kind': 'User',
    'recipient.id': uid,
    roleTemplate: 'Manager',
    revokedAt: null,
  }).lean()

  const endorsements: TrustGraphEndorsement[] = []
  for (const g of grants) {
    const granterClaimantId = await getClaimantId(g.grantedOn.kind, g.grantedOn.id)
    if (!granterClaimantId) continue
    // Don't count self-grants (granter's claimant is the same user).
    if (granterClaimantId.toString() === uid.toString()) continue
    endorsements.push({
      grantingUnit: { kind: g.grantedOn.kind, id: g.grantedOn.id },
      grantedAt: g.grantedAt,
    })
  }

  return endorsements
}
