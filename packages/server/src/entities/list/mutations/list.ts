import { listCreate } from './listCreate'
import { listUpdate } from './listUpdate'
import { listDelete } from './listDelete'
import { listAddItem } from './listAddItem'
import { listRemoveItem } from './listRemoveItem'
import { listReorderItems } from './listReorderItems'
import { listAddCollaborator } from './listAddCollaborator'
import { listRemoveCollaborator } from './listRemoveCollaborator'
import { listSetEditorial } from './listSetEditorial'

export const listMutations = {
  listCreate,
  listUpdate,
  listDelete,
  listAddItem,
  listRemoveItem,
  listReorderItems,
  listAddCollaborator,
  listRemoveCollaborator,
  listSetEditorial
}
