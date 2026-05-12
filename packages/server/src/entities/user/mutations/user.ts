import { authenticateWithPhone } from './authenticateWithPhone'
import { createProfile } from './createProfile'
import { userUpdate } from './userUpdate'
import { userProfileUpdate } from './userProfileUpdate'
import { userDelete } from './userDelete'
import { userClaimPerson } from './userClaimPerson'
import { userUnclaimPerson } from './userUnclaimPerson'
import { adminUnclaimPerson } from './adminUnclaimPerson'
import { pingDashboardActivity } from './pingDashboardActivity'

export const userMutations = {
  authenticateWithPhone,
  createProfile,
  userUpdate,
  userProfileUpdate,
  userDelete,
  userClaimPerson,
  userUnclaimPerson,
  adminUnclaimPerson,
  pingDashboardActivity
}
