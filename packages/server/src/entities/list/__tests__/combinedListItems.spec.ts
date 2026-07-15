import { Types } from 'mongoose'
import { UserModel } from '../../user/userModel'
import { ShowModel } from '../../show/showModel'
import { VenueModel } from '../../venue/venueModel'
import { RunModel } from '../../run/runModel'
import { PerformanceModel } from '../../performance/performanceModel'
import { ListModel } from '../listModel'
import { ListItemModel } from '../listItemModel'
import { resolveDynamicListItems } from '../resolveDynamicListItems'

const HOUR = 60 * 60 * 1000
const DAY = 24 * HOUR

// Combined lists filter to a real, relative date window. We use `this_month`
// with performances a couple of hours out (reliably in-window) versus ~400 days
// out (reliably out-of-window), which keeps the assertions clock-independent.
describe('combined list items', () => {
  let user: any
  let venue: any
  let showManual: any // in-window, reached via a manual source list
  let showEntity: any // in-window, reached via an entity source list
  let showFuture: any // only has a far-future performance → excluded
  let manualList: any
  let entityList: any

  async function makeShowWithPerf (title: string, perfDate: Date) {
    const show = await new ShowModel({ title, submittedBy: user._id }).save()
    const run = await new RunModel({ show: show._id, venues: [venue._id], submittedBy: user._id }).save()
    await new PerformanceModel({ run: run._id, venueId: venue._id, date: perfDate, submittedBy: user._id }).save()
    return show
  }

  beforeEach(async () => {
    await Promise.all([
      UserModel.deleteMany({}), ShowModel.deleteMany({}), VenueModel.deleteMany({}),
      RunModel.deleteMany({}), PerformanceModel.deleteMany({}),
      ListModel.deleteMany({}), ListItemModel.deleteMany({}),
    ])

    user = await new UserModel({ firebaseUid: 'u1', phoneNumber: '+15550002000', username: 'curator' }).save()
    venue = await new VenueModel({ name: 'The PIT', slug: `pit-${new Types.ObjectId()}`, venueType: 'theater', submittedBy: user._id }).save()

    const now = Date.now()
    showEntity = await makeShowWithPerf('Entity Show', new Date(now + 1 * HOUR)) // soonest
    showManual = await makeShowWithPerf('Manual Show', new Date(now + 2 * HOUR))
    showFuture = await makeShowWithPerf('Future Show', new Date(now + 400 * DAY)) // out of window

    // Manual source list holding showManual + showFuture by hand.
    manualList = await new ListModel({
      name: 'Hand Picks', slug: `hand-${new Types.ObjectId()}`, listType: 'shows',
      sourceMode: 'manual', owner: user._id, isEditorial: true
    }).save()
    await new ListItemModel({ list: manualList._id, itemId: showManual._id, position: 0, addedBy: user._id }).save()
    await new ListItemModel({ list: manualList._id, itemId: showFuture._id, position: 1, addedBy: user._id }).save()

    // Entity source list: every show at the venue (all three).
    entityList = await new ListModel({
      name: 'At The PIT', slug: `atpit-${new Types.ObjectId()}`, listType: 'shows',
      sourceMode: 'entity', sourceEntityType: 'venue', sourceEntityId: venue._id,
      owner: user._id, isEditorial: true
    }).save()
  })

  function combinedList (extra: any = {}) {
    return { sourceMode: 'combined', dateWindow: 'this_month', sourceListIds: [manualList._id, entityList._id], ...extra }
  }

  it('unions its source lists and keeps only shows with an in-window performance, soonest first', async () => {
    const shows = await resolveDynamicListItems(combinedList(), { user: { id: user._id.toString() } })
    // Future Show is dropped (no performance this month); Entity (+1h) sorts before Manual (+2h).
    expect(shows.map((s: any) => s.title)).toEqual(['Entity Show', 'Manual Show'])
    expect(shows.every((s: any) => s._listType === 'shows')).toBe(true)
  })

  it('dedupes a show that appears in more than one source list', async () => {
    // Add showEntity to the manual list too — it now comes from both sources.
    await new ListItemModel({ list: manualList._id, itemId: showEntity._id, position: 2, addedBy: user._id }).save()
    const shows = await resolveDynamicListItems(combinedList(), { user: { id: user._id.toString() } })
    const entityCount = shows.filter((s: any) => s.title === 'Entity Show').length
    expect(entityCount).toBe(1)
  })

  it('returns empty when no source lists are set', async () => {
    const shows = await resolveDynamicListItems(combinedList({ sourceListIds: [] }), { user: { id: user._id.toString() } })
    expect(shows).toEqual([])
  })

  it('returns empty when no date window is set', async () => {
    const shows = await resolveDynamicListItems(combinedList({ dateWindow: undefined }), { user: { id: user._id.toString() } })
    expect(shows).toEqual([])
  })

  it('ignores nested combined lists among its sources', async () => {
    const nested = await new ListModel({
      name: 'Nested', slug: `nested-${new Types.ObjectId()}`, listType: 'shows',
      sourceMode: 'combined', dateWindow: 'this_month', sourceListIds: [manualList._id],
      owner: user._id, isEditorial: true
    }).save()
    const shows = await resolveDynamicListItems(
      combinedList({ sourceListIds: [nested._id] }),
      { user: { id: user._id.toString() } }
    )
    expect(shows).toEqual([])
  })
})
