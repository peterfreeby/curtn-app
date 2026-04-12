import { dataSourceCreate } from './dataSourceCreate'
import { dataSourceUpdate } from './dataSourceUpdate'
import { dataSourceDelete } from './dataSourceDelete'
import { csvImport } from './csvImport'
import { wikidataSearch, wikidataImport } from './wikidataImport'
import { testParsingTemplate } from './testParsingTemplate'
import { scrapeUrl } from './scrapeUrl'

export const dataSourceMutations = { dataSourceCreate, dataSourceUpdate, dataSourceDelete, csvImport, wikidataSearch, wikidataImport, testParsingTemplate, scrapeUrl }
