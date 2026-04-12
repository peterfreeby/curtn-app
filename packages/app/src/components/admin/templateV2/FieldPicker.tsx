"use client"

import { useState, useRef, useEffect } from "react"
import { CSV_FIELD_GROUPS } from "./csvFieldGroups"

interface FieldPickerProps {
  usedFields?: Set<string>  // fields already mapped at this level (dimmed)
  onSelect: (fieldKey: string) => void
  onCancel: () => void
}

export function FieldPicker({ usedFields, onSelect, onCancel }: FieldPickerProps) {
  const [search, setSearch] = useState("")
  const ref = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onCancel()
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [onCancel])

  const lowerSearch = search.toLowerCase()

  return (
    <div ref={ref} className="border border-curtn-dark/30 rounded bg-curtn-surface shadow-lg overflow-hidden">
      <div className="p-2 border-b border-curtn-dark/20">
        <input
          ref={inputRef}
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search fields..."
          className="w-full text-xs bg-curtn-deep border border-curtn-dark/30 rounded px-2 py-1.5 text-curtn-cream focus:border-curtn-coral outline-none"
        />
      </div>
      <div className="max-h-64 overflow-y-auto">
        {CSV_FIELD_GROUPS.map(group => {
          const filteredFields = group.fields.filter(f =>
            !lowerSearch ||
            f.label.toLowerCase().includes(lowerSearch) ||
            f.key.toLowerCase().includes(lowerSearch) ||
            group.group.toLowerCase().includes(lowerSearch)
          )
          if (filteredFields.length === 0) return null

          return (
            <div key={group.group}>
              <div className="px-3 py-1.5 text-xs font-medium text-curtn-muted/60 uppercase tracking-wide bg-curtn-dark/20">
                {group.group}
              </div>
              {filteredFields.map(field => {
                const isUsed = usedFields?.has(field.key)
                return (
                  <button
                    key={field.key}
                    onClick={() => !isUsed && onSelect(field.key)}
                    disabled={isUsed}
                    className={`w-full text-left px-3 py-1.5 text-xs transition-colors ${
                      isUsed
                        ? 'text-curtn-muted/30 cursor-not-allowed'
                        : 'text-curtn-cream hover:bg-curtn-dark/40 cursor-pointer'
                    }`}
                  >
                    {field.label}
                    {field.hint && <span className="text-curtn-muted/40 ml-1.5">({field.hint})</span>}
                    {isUsed && <span className="text-curtn-muted/30 ml-1.5">mapped</span>}
                  </button>
                )
              })}
            </div>
          )
        })}
      </div>
    </div>
  )
}
