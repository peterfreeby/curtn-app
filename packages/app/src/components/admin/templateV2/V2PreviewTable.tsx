"use client"

import { CSV_FIELD_LABELS } from "./csvFieldGroups"

type FlatRow = Record<string, string | undefined>

interface V2PreviewTableProps {
  rows: FlatRow[]
}

// Fields with URLs that should render as links
const URL_FIELDS = new Set([
  'showUrl', 'showImageUrl', 'showPosterUrl', 'venueWebsite', 'venueImageUrl',
  'runImageUrl', 'runPosterUrl', 'ticketUrl', 'performanceImageUrl',
  'companyLogoUrl', 'personHeadshotUrl'
])

// Fields with images that should show thumbnails
const IMAGE_FIELDS = new Set([
  'showImageUrl', 'showPosterUrl', 'venueImageUrl', 'runImageUrl',
  'runPosterUrl', 'performanceImageUrl', 'companyLogoUrl', 'personHeadshotUrl'
])

export function V2PreviewTable({ rows }: V2PreviewTableProps) {
  if (rows.length === 0) {
    return <p className="text-sm text-curtn-muted">No rows extracted. Check your template.</p>
  }

  // Determine which columns have data
  const allKeys = new Set<string>()
  for (const row of rows) {
    for (const [key, val] of Object.entries(row)) {
      if (val) allKeys.add(key)
    }
  }

  // Order by CSV_FIELD_GROUPS order
  const orderedKeys = Array.from(allKeys).sort((a, b) => {
    const labelA = CSV_FIELD_LABELS[a] || a
    const labelB = CSV_FIELD_LABELS[b] || b
    return labelA.localeCompare(labelB)
  })

  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-curtn-dark/30">
              {orderedKeys.map(key => (
                <th key={key} className="text-left text-curtn-muted font-medium py-2 px-2 whitespace-nowrap">
                  {CSV_FIELD_LABELS[key] || key}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i} className="border-b border-curtn-dark/10 align-top">
                {orderedKeys.map(key => {
                  const val = row[key]
                  return (
                    <td key={key} className="py-2 px-2 text-curtn-cream max-w-[200px]">
                      {!val ? (
                        <span className="text-curtn-muted/30">—</span>
                      ) : IMAGE_FIELDS.has(key) ? (
                        <img
                          src={val}
                          alt=""
                          className="w-10 h-10 object-cover rounded"
                          onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
                        />
                      ) : URL_FIELDS.has(key) ? (
                        <a href={val} target="_blank" rel="noopener" className="text-curtn-coral hover:underline truncate block">
                          link
                        </a>
                      ) : (
                        <span className="truncate block">{val}</span>
                      )}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-curtn-muted mt-2">
        {rows.length} row{rows.length !== 1 ? 's' : ''} extracted
      </p>
    </div>
  )
}
