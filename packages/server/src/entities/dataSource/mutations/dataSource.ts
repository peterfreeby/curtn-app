import { dataSourceCreate } from './dataSourceCreate'
import { csvImport } from './csvImport'
import { wikidataSearch, wikidataImport } from './wikidataImport'

export const dataSourceMutations = { dataSourceCreate, csvImport, wikidataSearch, wikidataImport }
