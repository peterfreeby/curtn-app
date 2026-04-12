export interface CsvFieldDef {
  key: string
  label: string
  hint?: string
}

export interface CsvFieldGroup {
  group: string
  fields: CsvFieldDef[]
}

export const CSV_FIELD_GROUPS: CsvFieldGroup[] = [
  {
    group: 'Show',
    fields: [
      { key: 'title', label: 'Title', hint: 'Required for every import' },
      { key: 'showDescription', label: 'Description' },
      { key: 'performanceTypes', label: 'Performance Types', hint: 'Comma-separated' },
      { key: 'duration', label: 'Duration', hint: 'Minutes' },
      { key: 'showUrl', label: 'Website URL' },
      { key: 'showImageUrl', label: 'Image URL' },
      { key: 'showPosterUrl', label: 'Poster URL' },
      { key: 'languages', label: 'Languages', hint: 'Comma-separated' },
    ]
  },
  {
    group: 'Venue',
    fields: [
      { key: 'venueName', label: 'Venue Name' },
      { key: 'stageName', label: 'Stage Name' },
      { key: 'venueDescription', label: 'Venue Description' },
      { key: 'venueAddress', label: 'Address' },
      { key: 'venueCity', label: 'City' },
      { key: 'venueState', label: 'State' },
      { key: 'venueZipCode', label: 'Zip Code' },
      { key: 'venueCapacity', label: 'Capacity' },
      { key: 'venueType', label: 'Venue Type' },
      { key: 'venueWebsite', label: 'Website' },
      { key: 'venuePhone', label: 'Phone' },
      { key: 'venueEmail', label: 'Email' },
      { key: 'venueImageUrl', label: 'Venue Image URL' },
    ]
  },
  {
    group: 'Run',
    fields: [
      { key: 'runTitle', label: 'Run Title' },
      { key: 'runDescription', label: 'Run Description' },
      { key: 'runStartDate', label: 'Start Date' },
      { key: 'runEndDate', label: 'End Date' },
      { key: 'intermissions', label: 'Intermissions' },
      { key: 'runImageUrl', label: 'Run Image URL' },
      { key: 'runPosterUrl', label: 'Run Poster URL' },
    ]
  },
  {
    group: 'Performance',
    fields: [
      { key: 'date', label: 'Date' },
      { key: 'time', label: 'Time' },
      { key: 'startTime', label: 'Start Time' },
      { key: 'endTime', label: 'End Time' },
      { key: 'ticketUrl', label: 'Ticket URL' },
      { key: 'performanceDescription', label: 'Performance Description' },
      { key: 'soldOut', label: 'Sold Out' },
      { key: 'performanceImageUrl', label: 'Performance Image URL' },
    ]
  },
  {
    group: 'Company',
    fields: [
      { key: 'companyName', label: 'Company Name' },
      { key: 'companyDescription', label: 'Company Description' },
      { key: 'companyLogoUrl', label: 'Company Logo URL' },
    ]
  },
  {
    group: 'Person / Credit',
    fields: [
      { key: 'personName', label: 'Person Name' },
      { key: 'personRole', label: 'Role', hint: 'e.g., Hamlet, Director' },
      { key: 'creditType', label: 'Credit Type', hint: 'cast, crew, or creator' },
      { key: 'creditDepartment', label: 'Department', hint: 'cast, crew, creative, production, music' },
      { key: 'personHeadshotUrl', label: 'Headshot URL' },
    ]
  },
  {
    group: 'List',
    fields: [
      { key: 'listName', label: 'List Name' },
      { key: 'listType', label: 'List Type', hint: 'shows, venues, runs, performances, people' },
      { key: 'listDescription', label: 'List Description' },
      { key: 'listItemNote', label: 'List Item Note' },
    ]
  },
]

// Flat lookup for field label by key
export const CSV_FIELD_LABELS: Record<string, string> = {}
for (const group of CSV_FIELD_GROUPS) {
  for (const field of group.fields) {
    CSV_FIELD_LABELS[field.key] = field.label
  }
}
