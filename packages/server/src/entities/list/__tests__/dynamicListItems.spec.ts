import { Types } from 'mongoose'
import { UserModel } from '../../user/userModel'
import { ShowModel } from '../../show/showModel'
import { VenueModel } from '../../venue/venueModel'
import { PersonModel } from '../../person/personModel'
import { RunModel } from '../../run/runModel'
import { PerformanceModel } from '../../performance/performanceModel'
import { CreditModel } from '../../credit/creditModel'
import { EntityFollowModel } from '../../entityFollow/entityFollowModel'
import { showsForEntities } from '../dynamicListItems'
import { resolveDynamicListItems } from '../resolveDynamicListItems'

describe('dynamic list items', () => {
  let user: any
  let venue: any
  let person: any
  let showOld: any
  let showNew: any

  beforeEach(async () => {
    await Promise.all([
      UserModel.deleteMany({}), ShowModel.deleteMany({}), VenueModel.deleteMany({}),
      PersonModel.deleteMany({}), RunModel.deleteMany({}), PerformanceModel.deleteMany({}),
      CreditModel.deleteMany({}), EntityFollowModel.deleteMany({}),
    ])

    user = await new UserModel({ firebaseUid: 'u1', phoneNumber: '+15550001000', username: 'viewer' }).save()
    venue = await new VenueModel({ name: 'Caveat', slug: `caveat-${new Types.ObjectId()}`, venueType: 'theater', submittedBy: user._id }).save()
    person = await new PersonModel({ name: 'Actor', slug: `actor-${new Types.ObjectId()}`, submittedBy: user._id }).save()
    showOld = await new ShowModel({ title: 'Old Show', submittedBy: user._id }).save()
    showNew = await new ShowModel({ title: 'New Show', submittedBy: user._id }).save()

    // Two runs at the venue, each tied to a show, with performances of different dates
    const runOld = await new RunModel({ show: showOld._id, venues: [venue._id], submittedBy: user._id }).save()
    const runNew = await new RunModel({ show: showNew._id, venues: [venue._id], submittedBy: user._id }).save()
    await new PerformanceModel({ run: runOld._id, venueId: venue._id, date: new Date('2024-01-01'), submittedBy: user._id }).save()
    await new PerformanceModel({ run: runNew._id, venueId: venue._id, date: new Date('2025-06-01'), submittedBy: user._id }).save()

    // The actor is credited on the newer run only
    await new CreditModel({ person: person._id, run: runNew._id, creditType: 'cast', role: 'Lead', submittedBy: user._id }).save()
  })

  it('returns shows at a venue sorted by most recent performance date', async () => {
    const shows = await showsForEntities('venue', [venue._id])
    expect(shows.map(s => s.title)).toEqual(['New Show', 'Old Show'])
    // Each show carries id + _listType for the GraphQL layer
    expect(shows[0].id).toBe(shows[0]._id.toString())
    expect(shows[0]._listType).toBe('shows')
  })

  it('returns shows for a person via their credits', async () => {
    const shows = await showsForEntities('person', [person._id])
    expect(shows.map(s => s.title)).toEqual(['New Show'])
  })

  it('resolves an entity-mode list', async () => {
    const list = { sourceMode: 'entity', sourceEntityType: 'venue', sourceEntityId: venue._id }
    const shows = await resolveDynamicListItems(list, { user: { id: user._id.toString() } })
    expect(shows.map(s => s.title)).toEqual(['New Show', 'Old Show'])
  })

  it('resolves a follows-mode list from the viewer\'s entity follows', async () => {
    await new EntityFollowModel({ follower: user._id, targetType: 'venue', targetId: venue._id }).save()
    const list = { sourceMode: 'follows', followTargetType: 'venue' }
    const shows = await resolveDynamicListItems(list, { user: { id: user._id.toString() } })
    expect(shows.map(s => s.title).sort()).toEqual(['New Show', 'Old Show'])
  })

  it('returns empty for a follows-mode list when the viewer follows nothing', async () => {
    const list = { sourceMode: 'follows', followTargetType: 'venue' }
    const shows = await resolveDynamicListItems(list, { user: { id: user._id.toString() } })
    expect(shows).toEqual([])
  })

  it('returns empty for a follows-mode list with no viewer', async () => {
    const list = { sourceMode: 'follows', followTargetType: 'venue' }
    const shows = await resolveDynamicListItems(list, {})
    expect(shows).toEqual([])
  })
})
