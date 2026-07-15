import { dataSourceCreate } from './dataSourceCreate'
import { dataSourceUpdate } from './dataSourceUpdate'
import { dataSourceDelete } from './dataSourceDelete'
import { csvImport } from './csvImport'
import { wikidataSearch, wikidataImport } from './wikidataImport'
import { testParsingTemplate } from './testParsingTemplate'
import { scrapeUrl } from './scrapeUrl'
import { createClaimantSync } from './createClaimantSync'
import { disconnectClaimantSync } from './disconnectClaimantSync'
import { testSyncSource } from './testSyncSource'
import { setSourceAcceptedGaps } from './setSourceAcceptedGaps'

export const dataSourceMutations = {
  dataSourceCreate,
  dataSourceUpdate,
  dataSourceDelete,
  csvImport,
  wikidataSearch,
  wikidataImport,
  testParsingTemplate,
  scrapeUrl,
  createClaimantSync,
  disconnectClaimantSync,
  testSyncSource,
  setSourceAcceptedGaps,
}
