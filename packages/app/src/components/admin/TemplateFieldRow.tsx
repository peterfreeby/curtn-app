"use client"

import { useState } from "react"
import { Button } from "@/components/Button"

export interface SelectorRule {
  selector: string
  attribute?: string
  regex?: string
  transform?: 'date' | 'time' | 'datetime' | 'currency' | 'trim'
}

interface TemplateFieldRowProps {
  fieldName: string
  label: string
  required?: boolean
  rule: SelectorRule | undefined
  isActive: boolean
  previewText: string | null
  onActivate: () => void
  onClear: () => void
  onUpdateRule: (rule: SelectorRule) => void
}

export function TemplateFieldRow({
  fieldName,
  label,
  required,
  rule,
  isActive,
  previewText,
  onActivate,
  onClear,
  onUpdateRule
}: TemplateFieldRowProps) {
  const [expanded, setExpanded] = useState(false)

  const isMapped = rule && rule.selector

  return (
    <div className={`border rounded p-3 ${isActive ? 'border-curtn-coral bg-curtn-coral/5' : 'border-curtn-dark/30'}`}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-sm font-medium text-curtn-cream">
            {label}
            {required && <span className="text-curtn-coral ml-0.5">*</span>}
          </span>
          {isMapped && (
            <span className="text-xs text-green-400">mapped</span>
          )}
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {isMapped && (
            <>
              <button
                onClick={() => setExpanded(!expanded)}
                className="text-xs text-curtn-muted hover:text-curtn-cream"
              >
                {expanded ? 'collapse' : 'options'}
              </button>
              <Button variant="tertiary" size="sm" onClick={onClear}>
                Clear
              </Button>
            </>
          )}
          <Button
            variant={isActive ? "primary" : "secondary"}
            size="sm"
            onClick={onActivate}
          >
            {isActive ? 'Selecting...' : isMapped ? 'Re-select' : 'Select'}
          </Button>
        </div>
      </div>

      {isMapped && (
        <div className="mt-2">
          <code className="text-xs text-curtn-muted bg-curtn-deep px-2 py-1 rounded block overflow-x-auto">
            {rule.selector}
          </code>
          {previewText && (
            <p className="text-xs text-curtn-cream/70 mt-1 truncate">
              Preview: {previewText}
            </p>
          )}
        </div>
      )}

      {expanded && isMapped && (
        <div className="mt-3 space-y-2 border-t border-curtn-dark/20 pt-2">
          <div>
            <label className="text-xs text-curtn-muted block mb-1">
              Attribute (leave empty for text content)
            </label>
            <input
              type="text"
              value={rule.attribute || ''}
              onChange={e => onUpdateRule({ ...rule, attribute: e.target.value || undefined })}
              placeholder="e.g. href, src, datetime"
              className="w-full text-xs bg-curtn-deep border border-curtn-dark/30 rounded px-2 py-1 text-curtn-cream focus:border-curtn-coral outline-none"
            />
          </div>
          <div>
            <label className="text-xs text-curtn-muted block mb-1">
              Regex (capture group 1 or full match)
            </label>
            <input
              type="text"
              value={rule.regex || ''}
              onChange={e => onUpdateRule({ ...rule, regex: e.target.value || undefined })}
              placeholder="e.g. (\d{4}-\d{2}-\d{2})"
              className="w-full text-xs bg-curtn-deep border border-curtn-dark/30 rounded px-2 py-1 text-curtn-cream focus:border-curtn-coral outline-none"
            />
          </div>
          <div>
            <label className="text-xs text-curtn-muted block mb-1">
              Transform
            </label>
            <select
              value={rule.transform || ''}
              onChange={e => onUpdateRule({
                ...rule,
                transform: (e.target.value || undefined) as SelectorRule['transform']
              })}
              className="w-full text-xs bg-curtn-deep border border-curtn-dark/30 rounded px-2 py-1 text-curtn-cream focus:border-curtn-coral outline-none"
            >
              <option value="">None</option>
              <option value="date">Date</option>
              <option value="time">Time</option>
              <option value="datetime">DateTime</option>
              <option value="currency">Currency</option>
              <option value="trim">Trim</option>
            </select>
          </div>
        </div>
      )}
    </div>
  )
}
