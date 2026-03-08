import { userCreate } from './userCreate'
import { userUpdate } from './userUpdate'
import { userProfileUpdate } from './userProfileUpdate'
import { userDelete } from './userDelete'
import { loginUser } from './loginUser'
import { userLogout } from './userLogout'
import { userRefreshToken } from './userRefreshToken'

export const userMutations = {
  userCreate,
  userUpdate,
  userProfileUpdate,
  userDelete,
  loginUser,
  userLogout,
  userRefreshToken
}
