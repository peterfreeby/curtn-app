"use client"

interface ParsedEvent {
  title?: string | null
  description?: string | null
  date?: string | null
  time?: string | null
  venue?: string | null
  ticketUrl?: string | null
  imageUrl?: string | null
  price?: string | null
}

interface TemplatePreviewTableProps {
  events: ParsedEvent[]
}

export function TemplatePreviewTable({ events }: TemplatePreviewTableProps) {
  if (events.length === 0) {
    return (
      <p className="text-sm text-curtn-muted">No events extracted. Check your selectors.</p>
    )
  }

  // Figure out which columns have data
  const columns: { key: keyof ParsedEvent; label: string }[] = [
    { key: 'title', label: 'Title' },
    { key: 'date', label: 'Date' },
    { key: 'time', label: 'Time' },
    { key: 'venue', label: 'Venue' },
    { key: 'description', label: 'Description' },
    { key: 'ticketUrl', label: 'Ticket URL' },
    { key: 'imageUrl', label: 'Image' },
    { key: 'price', label: 'Price' }
  ]

  const activeColumns = columns.filter(col =>
    events.some(e => e[col.key])
  )

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-curtn-dark/30">
            {activeColumns.map(col => (
              <th key={col.key} className="text-left text-curtn-muted font-medium py-2 px-2">
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {events.map((event, i) => (
            <tr key={i} className="border-b border-curtn-dark/10">
              {activeColumns.map(col => (
                <td key={col.key} className="py-2 px-2 text-curtn-cream max-w-[200px] truncate">
                  {col.key === 'date' && event.date
                    ? new Date(event.date).toLocaleDateString()
                    : col.key === 'ticketUrl' && event.ticketUrl
                      ? <a href={event.ticketUrl} target="_blank" rel="noopener" className="text-curtn-coral hover:underline">link</a>
                      : col.key === 'imageUrl' && event.imageUrl
                        ? <a href={event.imageUrl} target="_blank" rel="noopener" className="text-curtn-coral hover:underline">image</a>
                        : event[col.key] || '—'
                  }
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="text-xs text-curtn-muted mt-2">
        {events.length} event{events.length !== 1 ? 's' : ''} extracted
      </p>
    </div>
  )
}
