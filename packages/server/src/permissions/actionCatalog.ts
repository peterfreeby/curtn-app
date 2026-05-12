// Action catalog: the named verbs trusted-editor scope can grant. Phase 1 ships the
// data; Phase 5 wires it into `canPerform` for trusted-editor checks. Role templates
// compile down to action sets.
// See Projects/Claim & Edit Authority Model — Phase 1 — Scoping (D5) for design.

export type ActionTargetKind = 'Venue' | 'ProductionCompany' | 'Person' | 'Performance'

export type ActionId =
  // Venue
  | 'venue.edit_name'
  | 'venue.edit_address'
  | 'venue.edit_description'
  | 'venue.edit_contact'
  | 'venue.edit_images'
  | 'venue.edit_capacity'
  | 'venue.add_stage'
  | 'venue.edit_stage'
  | 'venue.remove_stage'
  | 'venue.mark_closed'
  // ProductionCompany
  | 'company.edit_name'
  | 'company.edit_description'
  | 'company.edit_logo'
  | 'company.add_run'
  | 'company.edit_run'
  | 'company.edit_run_cast'
  // Person
  | 'person.edit_name'
  | 'person.edit_bio'
  | 'person.edit_headshot'
  | 'person.add_credit'
  | 'person.edit_credit'
  // Performance (joint stewardship — venue × productionCompany)
  | 'performance.edit_date_time'
  | 'performance.edit_ticket_url'
  | 'performance.edit_stage_override'
  | 'performance.edit_metadata_override'
  | 'performance.edit_credit_overrides'

export interface ActionSpec {
  id: ActionId
  targetType: ActionTargetKind
  description: string
  // True when both the venue claimant AND the run's productionCompany claimant must
  // approve. Only set on Performance actions in v1.
  jointStewardship?: boolean
}

export const ACTION_CATALOG: Record<ActionId, ActionSpec> = {
  // Venue
  'venue.edit_name':        { id: 'venue.edit_name',        targetType: 'Venue', description: 'Edit venue name' },
  'venue.edit_address':     { id: 'venue.edit_address',     targetType: 'Venue', description: 'Edit address, city, state, zip' },
  'venue.edit_description': { id: 'venue.edit_description', targetType: 'Venue', description: 'Edit venue description' },
  'venue.edit_contact':     { id: 'venue.edit_contact',     targetType: 'Venue', description: 'Edit website, phone, email' },
  'venue.edit_images':      { id: 'venue.edit_images',      targetType: 'Venue', description: 'Edit venue image' },
  'venue.edit_capacity':    { id: 'venue.edit_capacity',    targetType: 'Venue', description: 'Edit seating capacity' },
  'venue.add_stage':        { id: 'venue.add_stage',        targetType: 'Venue', description: 'Add a stage to the venue' },
  'venue.edit_stage':       { id: 'venue.edit_stage',       targetType: 'Venue', description: 'Edit a stage on the venue' },
  'venue.remove_stage':     { id: 'venue.remove_stage',     targetType: 'Venue', description: 'Remove a stage' },
  'venue.mark_closed':      { id: 'venue.mark_closed',      targetType: 'Venue', description: 'Mark venue permanently closed' },

  // ProductionCompany
  'company.edit_name':        { id: 'company.edit_name',        targetType: 'ProductionCompany', description: 'Edit company name' },
  'company.edit_description': { id: 'company.edit_description', targetType: 'ProductionCompany', description: 'Edit company description' },
  'company.edit_logo':        { id: 'company.edit_logo',        targetType: 'ProductionCompany', description: 'Edit company logo' },
  'company.add_run':          { id: 'company.add_run',          targetType: 'ProductionCompany', description: 'Add a new run' },
  'company.edit_run':         { id: 'company.edit_run',         targetType: 'ProductionCompany', description: 'Edit run-level fields (title, dates, description)' },
  'company.edit_run_cast':    { id: 'company.edit_run_cast',    targetType: 'ProductionCompany', description: 'Edit run-level cast / creative credits' },

  // Person
  'person.edit_name':     { id: 'person.edit_name',     targetType: 'Person', description: `Edit person's name` },
  'person.edit_bio':      { id: 'person.edit_bio',      targetType: 'Person', description: 'Edit biography' },
  'person.edit_headshot': { id: 'person.edit_headshot', targetType: 'Person', description: 'Edit headshot' },
  'person.add_credit':    { id: 'person.add_credit',    targetType: 'Person', description: 'Add a credit to this person' },
  'person.edit_credit':   { id: 'person.edit_credit',   targetType: 'Person', description: 'Edit one of this person’s credits' },

  // Performance — joint stewardship
  'performance.edit_date_time':          { id: 'performance.edit_date_time',          targetType: 'Performance', description: 'Edit date / time', jointStewardship: true },
  'performance.edit_ticket_url':         { id: 'performance.edit_ticket_url',         targetType: 'Performance', description: 'Edit ticket URL',  jointStewardship: true },
  'performance.edit_stage_override':     { id: 'performance.edit_stage_override',     targetType: 'Performance', description: 'Edit stage override', jointStewardship: true },
  'performance.edit_metadata_override':  { id: 'performance.edit_metadata_override',  targetType: 'Performance', description: 'Edit metadata overrides (description, image)', jointStewardship: true },
  'performance.edit_credit_overrides':   { id: 'performance.edit_credit_overrides',   targetType: 'Performance', description: 'Edit credit overrides (per-performance cast)', jointStewardship: true },
}

export const ALL_ACTION_IDS = Object.keys(ACTION_CATALOG) as ActionId[]

// Role templates — starting points for trusted-editor grants. Customization via
// per-action toggles. Defaults shown when forming a grant vary by recipient unit
// type; UI consumes these in Phase 5.

export type RoleTemplateId = 'Manager' | 'Booker' | 'Publicist' | 'Personal'

export const ROLE_TEMPLATES: Record<RoleTemplateId, ActionId[]> = {
  // Manager — full edit access on the granted unit type. We synthesize this set
  // at consumption time based on `targetType` of the granted unit.
  Manager: ALL_ACTION_IDS,

  Booker: [
    'venue.add_stage',
    'venue.edit_stage',
    'company.add_run',
    'company.edit_run',
    'performance.edit_date_time',
    'performance.edit_ticket_url',
    'performance.edit_stage_override',
  ],

  Publicist: [
    'venue.edit_description',
    'venue.edit_contact',
    'venue.edit_images',
    'company.edit_description',
    'company.edit_logo',
    'person.edit_bio',
    'person.edit_headshot',
  ],

  Personal: [
    'person.edit_name',
    'person.edit_bio',
    'person.edit_headshot',
    'person.add_credit',
    'person.edit_credit',
  ],
}

export function isJointStewardshipAction(actionId: ActionId): boolean {
  return ACTION_CATALOG[actionId]?.jointStewardship === true
}
