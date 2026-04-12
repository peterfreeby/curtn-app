"use client"

import { useState } from "react"
import { Button } from "@/components/Button"
import { CSV_FIELD_LABELS } from "./csvFieldGroups"

export interface FieldNodeData {
  type: 'field'
  id: string
  csvField: string
  selector?: string
  attribute?: string
  regex?: string
  transform?: string
  staticValue?: string
  presetValue?: string
}

interface FieldNodeRowProps {
  node: FieldNodeData
  isActive: boolean
  previewText?: string | null
  onActivate: () => void
  onUpdate: (updates: Partial<FieldNodeData>) => void
  onDelete: () => void
  onInspect?: (selector: string) => void
}

type Mode = 'select' | 'static' | 'preset'

function getMode(node: FieldNodeData): Mode {
  if (node.staticValue !== undefined && node.staticValue !== '') return 'static'
  if (node.presetValue !== undefined && node.presetValue !== '') return 'preset'
  return 'select'
}

export function FieldNodeRow({
  node,
  isActive,
  previewText,
  onActivate,
  onUpdate,
  onDelete,
  onInspect
}: FieldNodeRowProps) {
  const [mode, setMode] = useState<Mode>(getMode(node))
  const [showOptions, setShowOptions] = useState(false)
  const [editingSelector, setEditingSelector] = useState(false)
  const [selectorDraft, setSelectorDraft] = useState('')

  const label = CSV_FIELD_LABELS[node.csvField] || node.csvField
  const hasValue = !!(node.selector || node.staticValue || node.presetValue)

  return (
    <div className={`border rounded p-2.5 ${isActive ? 'border-curtn-coral bg-curtn-coral/5' : 'border-curtn-dark/30'}`}>
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-xs font-medium text-curtn-cream">{label}</span>
          <span className="text-xs text-curtn-muted/40">{node.csvField}</span>
          {hasValue && <span className="text-xs text-green-400">set</span>}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {hasValue && (
            <button
              onClick={() => setShowOptions(!showOptions)}
              className="text-xs text-curtn-muted hover:text-curtn-cream"
            >
              {showOptions ? '−' : '⋯'}
            </button>
          )}
          <button
            onClick={onDelete}
            className="text-xs text-curtn-muted/40 hover:text-curtn-red"
            title="Remove field"
          >
            ×
          </button>
        </div>
      </div>

      {/* Mode switcher */}
      <div className="flex gap-1 mt-2">
        {(['select', 'static', 'preset'] as Mode[]).map(m => (
          <button
            key={m}
            onClick={() => {
              setMode(m)
              // Clear other modes' values
              if (m === 'select') onUpdate({ staticValue: undefined, presetValue: undefined })
              if (m === 'static') onUpdate({ selector: undefined, attribute: undefined, presetValue: undefined })
              if (m === 'preset') onUpdate({ selector: undefined, attribute: undefined, staticValue: undefined })
            }}
            className={`text-xs px-2 py-0.5 rounded ${
              mode === m
                ? 'bg-curtn-coral/20 text-curtn-coral'
                : 'bg-curtn-deep text-curtn-muted hover:text-curtn-cream'
            }`}
          >
            {m === 'select' ? 'Selector' : m === 'static' ? 'Static' : 'Preset'}
          </button>
        ))}
      </div>

      {/* Select mode */}
      {mode === 'select' && (
        <div className="mt-2">
          {node.selector && !editingSelector ? (
            <div>
              <button
                onClick={() => { setSelectorDraft(node.selector || ''); setEditingSelector(true) }}
                className="text-xs text-curtn-muted bg-curtn-deep px-2 py-1 rounded block w-full text-left hover:bg-curtn-dark/40 cursor-text font-mono"
              >
                {node.selector}
              </button>
              {previewText && (
                <p className="text-xs text-curtn-cream/60 mt-1 truncate">→ {previewText}</p>
              )}
            </div>
          ) : editingSelector ? (
            <div className="space-y-1">
              <input
                type="text"
                value={selectorDraft}
                onChange={e => setSelectorDraft(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && selectorDraft.trim()) {
                    onUpdate({ selector: selectorDraft.trim() })
                    onInspect?.(selectorDraft.trim())
                    setEditingSelector(false)
                  }
                  if (e.key === 'Escape') setEditingSelector(false)
                }}
                autoFocus
                placeholder=".class-name or #id"
                className="w-full text-xs bg-curtn-deep border border-curtn-coral rounded px-2 py-1 text-curtn-cream font-mono focus:outline-none"
              />
              <div className="flex gap-1">
                <button
                  onClick={() => {
                    if (selectorDraft.trim()) {
                      onUpdate({ selector: selectorDraft.trim() })
                      onInspect?.(selectorDraft.trim())
                    }
                    setEditingSelector(false)
                  }}
                  className="text-xs px-2 py-0.5 rounded bg-curtn-coral/20 text-curtn-coral"
                >
                  Save
                </button>
                <button
                  onClick={() => setEditingSelector(false)}
                  className="text-xs px-2 py-0.5 text-curtn-muted"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="flex gap-1.5 mt-1">
              <Button
                variant={isActive ? "primary" : "secondary"}
                size="sm"
                onClick={onActivate}
              >
                {isActive ? 'Selecting...' : 'Click to Select'}
              </Button>
              <button
                onClick={() => { setSelectorDraft(''); setEditingSelector(true) }}
                className="text-xs text-curtn-muted/50 hover:text-curtn-muted"
              >
                or type
              </button>
            </div>
          )}
        </div>
      )}

      {/* Static mode */}
      {mode === 'static' && (
        <div className="mt-2">
          <input
            type="text"
            value={node.staticValue || ''}
            onChange={e => onUpdate({ staticValue: e.target.value })}
            placeholder={`Static value for ${label}`}
            className="w-full text-xs bg-curtn-deep border border-curtn-dark/30 rounded px-2 py-1.5 text-curtn-cream focus:border-curtn-coral outline-none"
          />
        </div>
      )}

      {/* Preset mode */}
      {mode === 'preset' && (
        <div className="mt-2">
          <input
            type="text"
            value={node.presetValue || ''}
            onChange={e => onUpdate({ presetValue: e.target.value })}
            placeholder={`Entity name (e.g., venue or company name)`}
            className="w-full text-xs bg-curtn-deep border border-curtn-dark/30 rounded px-2 py-1.5 text-curtn-cream focus:border-curtn-coral outline-none"
          />
          <p className="text-xs text-curtn-muted/40 mt-0.5">Matched by name during import</p>
        </div>
      )}

      {/* Advanced options */}
      {showOptions && mode === 'select' && node.selector && (
        <div className="mt-2 space-y-1.5 border-t border-curtn-dark/20 pt-2">
          <div>
            <label className="text-xs text-curtn-muted block mb-0.5">Attribute</label>
            <input
              type="text"
              value={node.attribute || ''}
              onChange={e => onUpdate({ attribute: e.target.value || undefined })}
              placeholder="href, src, datetime"
              className="w-full text-xs bg-curtn-deep border border-curtn-dark/30 rounded px-2 py-1 text-curtn-cream focus:border-curtn-coral outline-none"
            />
          </div>
          <div>
            <label className="text-xs text-curtn-muted block mb-0.5">Regex</label>
            <input
              type="text"
              value={node.regex || ''}
              onChange={e => onUpdate({ regex: e.target.value || undefined })}
              placeholder="(\d{4}-\d{2}-\d{2})"
              className="w-full text-xs bg-curtn-deep border border-curtn-dark/30 rounded px-2 py-1 text-curtn-cream focus:border-curtn-coral outline-none"
            />
          </div>
          <div>
            <label className="text-xs text-curtn-muted block mb-0.5">Transform</label>
            <select
              value={node.transform || ''}
              onChange={e => onUpdate({ transform: e.target.value || undefined })}
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
