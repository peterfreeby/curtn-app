import { performanceCreate } from './performanceCreate'
import { performanceUpdate } from './performanceUpdate'
import { performanceDelete } from './performanceDelete'
import { performanceMerge } from './performanceMerge'
import { performanceCreditRemove, performanceCreditRestore, performanceCreditAdd } from './performanceCreditOverride'

export const performanceMutations = {
  performanceCreate,
  performanceUpdate,
  performanceDelete,
  performanceMerge,
  performanceCreditRemove,
  performanceCreditRestore,
  performanceCreditAdd,
}
