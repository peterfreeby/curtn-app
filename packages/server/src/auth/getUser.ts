import Koa from 'koa'
import { firebaseAuth } from '../firebase/admin'
import { UserModel } from '../entities/user/userModel'

export async function getUser(ctx: Koa.Context): Promise<any>
export async function getUser(ctx: { authorization?: string }): Promise<any>
export async function getUser(ctx: Koa.Context | { authorization?: string }) {
  let authorization: string | undefined

  if ('headers' in ctx && typeof ctx.headers === 'object') {
    authorization = (ctx.headers as Record<string, string | string[] | undefined>).authorization as string | undefined
  } else {
    authorization = (ctx as { authorization?: string }).authorization
  }

  if (!authorization) return null

  const parts = authorization.split(' ')

  if (parts.length !== 2) return null

  const [_, token] = parts

  try {
    const decoded = await firebaseAuth.verifyIdToken(token)

    return await UserModel.findOne({ firebaseUid: decoded.uid })
  } catch {
    return null
  }
}
