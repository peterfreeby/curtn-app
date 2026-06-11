export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 30

import { NextResponse } from 'next/server'
import { connectToDatabase } from '../../../../../server/src/db/mongoose'
import { getUser } from '../../../../../server/src/auth/getUser'
import { geocodeAddress } from '../../../../../server/src/services/geocoding/geocodeAddress'

interface GeocodeBody {
  address?: string
  city?: string
  state?: string
  zipCode?: string
}

function composeAddress(b: GeocodeBody): string {
  return [b.address, b.city, b.state, b.zipCode]
    .map(p => p?.trim())
    .filter((p): p is string => !!p)
    .join(', ')
}

// Real-time geocode for the admin venue form. Returns coordinates + the
// canonical matched address, or { found: false } so the form can show inline
// "address not found" feedback before submit.
export async function POST(req: Request) {
  await connectToDatabase()

  const user = await getUser({
    authorization: req.headers.get('authorization') || undefined
  })
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const { UserModel } = await import(
    '../../../../../server/src/entities/user/userModel'
  )
  const adminUser = await UserModel.findById(user.id)
  if (!adminUser?.isAdmin) {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
  }

  let body: GeocodeBody
  try {
    body = (await req.json()) as GeocodeBody
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const query = composeAddress(body)
  if (!query) {
    return NextResponse.json({ found: false, reason: 'Empty address' })
  }

  const result = await geocodeAddress(query)
  if (!result) {
    return NextResponse.json({ found: false, query })
  }

  return NextResponse.json({
    found: true,
    lat: result.lat,
    lng: result.lng,
    matchedAddress: result.matchedAddress ?? null,
    provider: result.provider
  })
}
