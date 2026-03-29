import { userCreate } from './userCreate'
import { userUpdate } from './userUpdate'
import { userProfileUpdate } from './userProfileUpdate'
import { userDelete } from './userDelete'
import { loginUser } from './loginUser'
import { userLogout } from './userLogout'
import { userRefreshToken } from './userRefreshToken'
import { userClaimPerson } from './userClaimPerson'
import { userUnclaimPerson } from './userUnclaimPerson'

export const userMutations = {
  userCreate,
  userUpdate,
  userProfileUpdate,
  userDelete,
  loginUser,
  userLogout,
  userRefreshToken,
  userClaimPerson,
  userUnclaimPerson
}
