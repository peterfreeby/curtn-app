import { submitClaimRequest } from './submitClaimRequest'
import { submitClaimRequestNewPerson } from './submitClaimRequestNewPerson'
import { approveClaimRequest } from './approveClaimRequest'
import { rejectClaimRequest } from './rejectClaimRequest'

export const claimRequestMutations = {
  submitClaimRequest,
  submitClaimRequestNewPerson,
  approveClaimRequest,
  rejectClaimRequest
}
