import { submitClaimRequest } from './submitClaimRequest'
import { submitClaimRequestNewPerson } from './submitClaimRequestNewPerson'
import { approveClaimRequest } from './approveClaimRequest'
import { rejectClaimRequest } from './rejectClaimRequest'
import { submitClaim } from './submitClaim'
import { approveClaim } from './approveClaim'
import { declineClaim } from './declineClaim'

export const claimRequestMutations = {
  // Legacy Person-only flow (kept for backward compatibility)
  submitClaimRequest,
  submitClaimRequestNewPerson,
  approveClaimRequest,
  rejectClaimRequest,
  // Generalized polymorphic flow (Phase 2 — covers Venue, ProductionCompany, Person)
  submitClaim,
  approveClaim,
  declineClaim,
}
