import { CleanupRules } from '../feedParser/shared'

export interface SelectorRule {
  selector: string
  attribute?: string   // e.g., 'href', 'src', 'datetime' — defaults to textContent
  regex?: string       // optional regex to extract a substring from matched text
  transform?: 'date' | 'time' | 'datetime' | 'currency' | 'trim'
}

export interface CreditSelectorRule {
  containerSelector: string  // CSS selector for each credit entry (repeating)
  nameSelector: string       // CSS selector for the person's name within the container
  roleSelector?: string      // CSS selector for the role within the container
}

export interface ParsingTemplate {
  selectors: {
    title: SelectorRule
    date?: SelectorRule
    time?: SelectorRule
    venue?: SelectorRule
    description?: SelectorRule
    ticketUrl?: SelectorRule
    imageUrl?: SelectorRule
    price?: SelectorRule
    // Extended fields
    runTitle?: SelectorRule
    showDescription?: SelectorRule
    runDescription?: SelectorRule
    duration?: SelectorRule
    startDate?: SelectorRule
    endDate?: SelectorRule
  }
  credits?: CreditSelectorRule
  listSelector?: string        // CSS selector for the repeating container (list pages)
  useJsonLd?: boolean          // extract from JSON-LD <script> tags first
  jsonLdFieldMap?: Record<string, string>  // map schema.org fields to Curtn fields
  cleanup?: CleanupRules
}
