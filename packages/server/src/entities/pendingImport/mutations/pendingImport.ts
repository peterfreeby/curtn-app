import { pollDataSource } from './pollDataSource'
import { approvePendingImport, rejectPendingImport, editPendingImport, autoValidatePendingImports } from './reviewPendingImport'

export const pendingImportMutations = {
  pollDataSource,
  approvePendingImport,
  rejectPendingImport,
  editPendingImport,
  autoValidatePendingImports
}
