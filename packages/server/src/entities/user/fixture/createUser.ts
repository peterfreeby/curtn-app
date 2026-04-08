import { UserModel } from '../userModel'
import { randomUUID } from 'crypto'

type Options = {
  username: string
}

export async function createUser(options: Options) {
  const user = await UserModel.findOne({ username: options.username })

  if (user) return user

  const document = new UserModel({
    firebaseUid: `test-${randomUUID()}`,
    phoneNumber: '+15555550100',
    fullName: 'chad admin',
    username: options.username,
    isAdmin: false,
  })

  await document.save()

  return document
}
