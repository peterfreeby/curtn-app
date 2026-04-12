"use client"

interface ParsedCredit {
  name: string
  role?: string
}

interface ParsedEvent {
  title?: string | null
  description?: string | null
  date?: string | null
  time?: string | null
  venue?: string | null
  ticketUrl?: string | null
  imageUrl?: string | null
  price?: string | null
  runTitle?: string | null
  showDescription?: string | null
  runDescription?: string | null
  duration?: number | null
  startDate?: string | null
  endDate?: string | null
  credits?: ParsedCredit[] | null
}

interface TemplatePreviewTableProps {
  events: ParsedEvent[]
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString()
  } catch {
    return iso
  }
}

export function TemplatePreviewTable({ events }: TemplatePreviewTableProps) {
  if (events.length === 0) {
    return (
      <p className="text-sm text-curtn-muted">No events extracted. Check your selectors.</p>
    )
  }

  // Figure out which columns have data
  const columns: { key: keyof ParsedEvent; label: string }[] = [
    { key: 'imageUrl', label: 'Image' },
    { key: 'title', label: 'Title' },
    { key: 'runTitle', label: 'Run Title' },
    { key: 'date', label: 'Date' },
    { key: 'time', label: 'Time' },
    { key: 'startDate', label: 'Start' },
    { key: 'endDate', label: 'End' },
    { key: 'venue', label: 'Venue' },
    { key: 'duration', label: 'Duration' },
    { key: 'description', label: 'Description' },
    { key: 'showDescription', label: 'Show Desc' },
    { key: 'runDescription', label: 'Run Desc' },
    { key: 'ticketUrl', label: 'Tickets' },
    { key: 'price', label: 'Price' },
    { key: 'credits', label: 'Credits' },
  ]

  const activeColumns = columns.filter(col =>
    events.some(e => {
      const val = e[col.key]
      if (Array.isArray(val)) return val.length > 0
      return val
    })
  )

  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-curtn-dark/30">
              {activeColumns.map(col => (
                <th key={col.key} className="text-left text-curtn-muted font-medium py-2 px-2 whitespace-nowrap">
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {events.map((event, i) => (
              <tr key={i} className="border-b border-curtn-dark/10 align-top">
                {activeColumns.map(col => (
                  <td key={col.key} className="py-2 px-2 text-curtn-cream">
                    {renderCell(event, col.key)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-curtn-muted mt-2">
        {events.length} event{events.length !== 1 ? 's' : ''} extracted
      </p>
    </div>
  )
}

function renderCell(event: ParsedEvent, key: keyof ParsedEvent) {
  const val = event[key]

  if (key === 'imageUrl' && val) {
    return (
      <img
        src={val as string}
        alt=""
        className="w-16 h-16 object-cover rounded"
        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
      />
    )
  }

  if (key === 'ticketUrl' && val) {
    return (
      <a href={val as string} target="_blank" rel="noopener" className="text-curtn-coral hover:underline">
        link
      </a>
    )
  }

  if ((key === 'date' || key === 'startDate' || key === 'endDate') && val) {
    return <span className="whitespace-nowrap">{formatDate(val as string)}</span>
  }

  if (key === 'duration' && val != null) {
    return <span className="whitespace-nowrap">{String(val)} min</span>
  }

  if (key === 'credits' && Array.isArray(val) && val.length > 0) {
    return (
      <div className="space-y-0.5 max-w-[200px]">
        {(val as ParsedCredit[]).slice(0, 5).map((c, i) => (
          <div key={i} className="truncate">
            <span className="text-curtn-cream">{c.name}</span>
            {c.role && <span className="text-curtn-muted ml-1">({c.role})</span>}
          </div>
        ))}
        {val.length > 5 && (
          <span className="text-curtn-muted">+{val.length - 5} more</span>
        )}
      </div>
    )
  }

  if (key === 'description' || key === 'showDescription' || key === 'runDescription') {
    const text = val as string
    if (!text) return <span className="text-curtn-muted/40">—</span>
    return <span className="max-w-[200px] block truncate">{text}</span>
  }

  if (!val) return <span className="text-curtn-muted/40">—</span>
  if (typeof val === 'object') return <span className="text-curtn-muted/40">—</span>
  return <span className="max-w-[200px] block truncate">{String(val)}</span>
}
