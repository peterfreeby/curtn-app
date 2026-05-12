import { Types } from 'mongoose'
import { VenueModel } from '../../entities/venue/venueModel'
import { ProductionCompanyModel } from '../../entities/productionCompany/productionCompanyModel'
import { PersonModel } from '../../entities/person/personModel'

// Bump lastClaimantActivityAt on the claimant's units so they don't auto-expire.
//
// Two entry points:
//   - bumpForUnit: called by update mutations after a successful edit by the claimant
//   - bumpAllForUser: called by the dashboard ping on mount

type ClaimableKind = 'venue' | 'productionCompany' | 'person'

const MODEL_BY_KIND = {
  venue: VenueModel,
  productionCompany: ProductionCompanyModel,
  person: PersonModel,
} as const

export async function bumpForUnit(kind: ClaimableKind, unitId: string | Types.ObjectId) {
  const Model = MODEL_BY_KIND[kind]
  if (!Model) return
  await Model.updateOne(
    { _id: unitId, claimedBy: { $ne: null } },
    { $set: { lastClaimantActivityAt: new Date() } }
  )
}

export async function bumpAllForUser(userId: string | Types.ObjectId) {
  const now = new Date()
  await Promise.all([
    VenueModel.updateMany({ claimedBy: userId }, { $set: { lastClaimantActivityAt: now } }),
    ProductionCompanyModel.updateMany({ claimedBy: userId }, { $set: { lastClaimantActivityAt: now } }),
    PersonModel.updateMany({ claimedBy: userId }, { $set: { lastClaimantActivityAt: now } }),
  ])
}
