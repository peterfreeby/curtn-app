import { runFindOrCreate } from './runFindOrCreate'
import { runUpdate } from './runUpdate'
import { runDelete } from './runDelete'
import { runMerge } from './runMerge'

export const runMutations = {
  runFindOrCreate,
  runUpdate,
  runDelete,
  runMerge
}
