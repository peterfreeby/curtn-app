import { pollDataSource } from './pollDataSource'
import { approvePendingImport, rejectPendingImport, editPendingImport, autoValidatePendingImports, approveAllPendingImports } from './reviewPendingImport'
import { flagScraperIssue } from './flagScraperIssue'

export const pendingImportMutations = {
  pollDataSource,
  approvePendingImport,
  rejectPendingImport,
  editPendingImport,
  autoValidatePendingImports,
  approveAllPendingImports,
  flagScraperIssue
}
