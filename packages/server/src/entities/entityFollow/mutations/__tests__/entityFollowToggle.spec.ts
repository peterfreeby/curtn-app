import { Types } from 'mongoose'
import { toGlobalId } from 'graphql-relay'
import { UserModel } from '../../../user/userModel'
import { VenueModel } from '../../../venue/venueModel'
import { PersonModel } from '../../../person/personModel'
import { ProductionCompanyModel } from '../../../productionCompany/productionCompanyModel'
import { EntityFollowModel } from '../../entityFollowModel'
import { entityFollowToggle } from '../entityFollowToggle'

async function callMutation(input: any, ctx: any): Promise<any> {
  return (entityFollowToggle as any).resolve(null, { input }, ctx, null)
}

describe('entityFollowToggle', () => {
  let user: any
  let venue: any
  let person: any
  let company: any

  beforeEach(async () => {
    await Promise.all([
      UserModel.deleteMany({}),
      VenueModel.deleteMany({}),
      PersonModel.deleteMany({}),
      ProductionCompanyModel.deleteMany({}),
      EntityFollowModel.deleteMany({}),
    ])

    user = await new UserModel({
      firebaseUid: 'follower-uid', phoneNumber: '+15550000010', username: 'follower',
    }).save()
    venue = await new VenueModel({
      name: 'Caveat', slug: `caveat-${new Types.ObjectId().toString()}`, venueType: 'theater', submittedBy: user._id,
    }).save()
    person = await new PersonModel({
      name: 'Some Actor', slug: `actor-${new Types.ObjectId().toString()}`, submittedBy: user._id,
    }).save()
    company = await new ProductionCompanyModel({
      name: 'A Troupe', slug: `troupe-${new Types.ObjectId().toString()}`, submittedBy: user._id,
    }).save()
  })

  it('follows a venue, creating an EntityFollow', async () => {
    const result = await callMutation(
      { targetType: 'venue', targetId: toGlobalId('Venue', venue._id.toString()) },
      { user: { id: user._id.toString() } }
    )
    expect(result.error).toBeUndefined()
    expect(result.isFollowing).toBe(true)

    const doc = await EntityFollowModel.findOne({ follower: user._id, targetType: 'venue', targetId: venue._id })
    expect(doc).toBeTruthy()
  })

  it('toggles off on a second call, removing the EntityFollow', async () => {
    const input = { targetType: 'venue', targetId: toGlobalId('Venue', venue._id.toString()) }
    const ctx = { user: { id: user._id.toString() } }
    await callMutation(input, ctx)
    const result = await callMutation(input, ctx)

    expect(result.isFollowing).toBe(false)
    const count = await EntityFollowModel.countDocuments({ follower: user._id, targetId: venue._id })
    expect(count).toBe(0)
  })

  it('supports following a person and a production company', async () => {
    const ctx = { user: { id: user._id.toString() } }
    const p = await callMutation({ targetType: 'person', targetId: toGlobalId('Person', person._id.toString()) }, ctx)
    const c = await callMutation({ targetType: 'productionCompany', targetId: toGlobalId('ProductionCompany', company._id.toString()) }, ctx)

    expect(p.isFollowing).toBe(true)
    expect(c.isFollowing).toBe(true)
    expect(await EntityFollowModel.countDocuments({ follower: user._id })).toBe(2)
  })

  it('rejects an unauthenticated viewer', async () => {
    const result = await callMutation(
      { targetType: 'venue', targetId: toGlobalId('Venue', venue._id.toString()) },
      {}
    )
    expect(result.error).toBe('Unauthorized')
    expect(result.isFollowing).toBe(false)
  })

  it('rejects following a nonexistent entity', async () => {
    const result = await callMutation(
      { targetType: 'venue', targetId: toGlobalId('Venue', new Types.ObjectId().toString()) },
      { user: { id: user._id.toString() } }
    )
    expect(result.error).toBe('Entity not found')
    expect(result.isFollowing).toBe(false)
  })
})
