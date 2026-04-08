import { IUser } from '../userModel'

// In tests, we bypass Firebase token verification and pass the user directly via context.
// This fixture returns a mock authorization header for test compatibility.
export function loginUser(user: IUser): { token: string } {
  return {
    token: `test-token-${user._id.toString()}`
  }
}
