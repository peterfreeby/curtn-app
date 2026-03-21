import { venueUpdate } from './venueUpdate'
import { venueDelete } from './venueDelete'
import { venueMerge } from './venueMerge'
import { venueFindOrCreate } from './venueFindOrCreate'

export const venueMutations = {
  venueFindOrCreate,
  venueUpdate,
  venueDelete,
  venueMerge
}
