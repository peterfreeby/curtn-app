import { CleanupRules } from '../feedParser/shared'

export interface FieldNode {
  type: 'field'
  id: string                    // UUID for UI state management
  csvField: string              // CsvRowInput key: 'title', 'venueName', 'personName', etc.
  selector?: string             // CSS selector (for magic select / manual CSS mode)
  attribute?: string            // e.g., 'href', 'src', 'datetime'
  regex?: string                // regex to extract substring from matched text
  transform?: 'date' | 'time' | 'datetime' | 'currency' | 'trim' | 'date-range-start' | 'date-range-end'
  staticValue?: string          // for static mode — hardcoded value
  presetValue?: string          // for preset mode — entity name from database
}

export interface ContainerNode {
  type: 'container'
  id: string                    // UUID for UI state management
  label: string                 // Admin-facing label: "Cast", "Performances", etc.
  selector: string              // CSS selector for the repeating element
  children: TemplateNode[]      // nested fields and containers
}

export type TemplateNode = FieldNode | ContainerNode

export interface V2ParsingTemplate {
  version: 2
  nodes: TemplateNode[]
  useJsonLd?: boolean
  jsonLdFieldMap?: Record<string, string>
  cleanup?: CleanupRules
}

export function isV2Template(template: any): template is V2ParsingTemplate {
  return template?.version === 2 || Array.isArray(template?.nodes)
}
