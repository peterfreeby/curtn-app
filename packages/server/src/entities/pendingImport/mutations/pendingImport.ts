import { pollDataSource } from './pollDataSource'
import { approvePendingImport, rejectPendingImport, editPendingImport, autoValidatePendingImports, approveAllPendingImports } from './reviewPendingImport'

export const pendingImportMutations = {
  pollDataSource,
  approvePendingImport,
  rejectPendingImport,
  editPendingImport,
  autoValidatePendingImports,
  approveAllPendingImports
}
