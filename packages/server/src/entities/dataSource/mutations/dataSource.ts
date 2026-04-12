import { dataSourceCreate } from './dataSourceCreate'
import { dataSourceUpdate } from './dataSourceUpdate'
import { csvImport } from './csvImport'
import { wikidataSearch, wikidataImport } from './wikidataImport'
import { testParsingTemplate } from './testParsingTemplate'

export const dataSourceMutations = { dataSourceCreate, dataSourceUpdate, csvImport, wikidataSearch, wikidataImport, testParsingTemplate }
