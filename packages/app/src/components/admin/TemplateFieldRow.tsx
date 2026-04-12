"use client"

import { useState } from "react"
import { Button } from "@/components/Button"

export interface SelectorRule {
  selector: string
  attribute?: string
  regex?: string
  transform?: 'date' | 'time' | 'datetime' | 'currency' | 'trim'
}

export interface ElementInfo {
  selector: string
  textContent: string
  tagName: string
  childCount: number
  isCurrent?: boolean
  siblings?: ElementInfo[]
}

interface TemplateFieldRowProps {
  fieldName: string
  label: string
  required?: boolean
  rule: SelectorRule | undefined
  isActive: boolean
  previewText: string | null
  ancestors?: ElementInfo[]
  children?: ElementInfo[]
  onActivate: () => void
  onClear: () => void
  onUpdateRule: (rule: SelectorRule) => void
  onNavigate?: (selector: string, textContent: string) => void
  onInspect?: (selector: string) => void  // Ask iframe for fresh context without applying
}

export function TemplateFieldRow({
  fieldName,
  label,
  required,
  rule,
  isActive,
  previewText,
  ancestors,
  children,
  onActivate,
  onClear,
  onUpdateRule,
  onNavigate,
  onInspect
}: TemplateFieldRowProps) {
  const [expanded, setExpanded] = useState(false)
  const [showDepth, setShowDepth] = useState(false)
  const [expandedAncestor, setExpandedAncestor] = useState<number | null>(null)
  const [editingSelector, setEditingSelector] = useState(false)
  const [selectorDraft, setSelectorDraft] = useState('')

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
              {((ancestors && ancestors.length > 1) || (children && children.length > 0)) && (
                <button
                  onClick={() => { setShowDepth(!showDepth); setExpanded(false) }}
                  className="text-xs text-curtn-muted hover:text-curtn-cream"
                  title="Adjust selection depth"
                >
                  ↕
                </button>
              )}
              <button
                onClick={() => { setExpanded(!expanded); setShowDepth(false) }}
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

      {isMapped && !editingSelector && (
        <div className="mt-2">
          <button
            onClick={() => { setSelectorDraft(rule.selector); setEditingSelector(true) }}
            className="text-xs text-curtn-muted bg-curtn-deep px-2 py-1 rounded block overflow-x-auto w-full text-left hover:bg-curtn-dark/40 cursor-text"
            title="Click to edit selector"
          >
            <code>{rule.selector}</code>
          </button>
          {previewText && (
            <p className="text-xs text-curtn-cream/70 mt-1 truncate">
              Preview: {previewText}
            </p>
          )}
        </div>
      )}

      {editingSelector && (
        <div className="mt-2 space-y-1.5">
          <input
            type="text"
            value={selectorDraft}
            onChange={e => setSelectorDraft(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && selectorDraft.trim()) {
                onUpdateRule({ ...(rule || { selector: '' }), selector: selectorDraft.trim() })
                setEditingSelector(false)
              }
              if (e.key === 'Escape') setEditingSelector(false)
            }}
            autoFocus
            placeholder="CSS selector, e.g. .c-col-bio__name"
            className="w-full text-xs bg-curtn-deep border border-curtn-coral rounded px-2 py-1.5 text-curtn-cream font-mono focus:outline-none"
          />
          <div className="flex gap-1.5">
            <button
              onClick={() => {
                if (selectorDraft.trim()) {
                  onUpdateRule({ ...(rule || { selector: '' }), selector: selectorDraft.trim() })
                }
                setEditingSelector(false)
              }}
              className="text-xs px-2 py-1 rounded bg-curtn-coral/20 text-curtn-coral hover:bg-curtn-coral/30"
            >
              Save
            </button>
            <button
              onClick={() => setEditingSelector(false)}
              className="text-xs px-2 py-1 rounded text-curtn-muted hover:text-curtn-cream"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {!isMapped && !editingSelector && (
        <button
          onClick={() => { setSelectorDraft(''); setEditingSelector(true) }}
          className="mt-2 text-xs text-curtn-muted/50 hover:text-curtn-muted"
        >
          or type a selector manually
        </button>
      )}

      {/* Depth navigation */}
      {showDepth && isMapped && onNavigate && (
        <div className="mt-3 border-t border-curtn-dark/20 pt-2 space-y-2 max-h-[300px] overflow-y-auto">
          <p className="text-xs text-curtn-muted">Navigate the DOM tree:</p>

          {/* Ancestors — each level shows siblings when expanded */}
          {ancestors && ancestors.length > 1 && (
            <div className="space-y-1">
              <p className="text-xs text-curtn-muted/60">↑ Broader (parent elements)</p>
              {ancestors.slice(1).map((a, levelIndex) => {
                const sibCount = a.siblings?.filter(s => !s.isCurrent).length || 0
                const isExpanded = expandedAncestor === levelIndex
                return (
                  <div key={levelIndex}>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => onInspect?.(a.selector)}
                        className="flex-1 text-left text-xs px-2 py-1.5 rounded bg-curtn-deep hover:bg-curtn-dark/40 transition-colors"
                        title="Drill into this element"
                      >
                        <span className="text-curtn-coral">&lt;{a.tagName}&gt;</span>
                        <span className="text-curtn-muted ml-1">
                          {a.textContent.substring(0, 35)}{a.textContent.length > 35 ? '…' : ''}
                        </span>
                      </button>
                      {sibCount > 0 && (
                        <button
                          onClick={() => setExpandedAncestor(isExpanded ? null : levelIndex)}
                          className="shrink-0 text-xs px-1.5 py-1.5 rounded bg-curtn-deep hover:bg-curtn-dark/40 text-curtn-muted"
                          title={`${sibCount} sibling${sibCount > 1 ? 's' : ''} at this level`}
                        >
                          ←→ {sibCount}
                        </button>
                      )}
                      <button
                        onClick={() => {
                          onNavigate?.(a.selector, a.textContent)
                          setShowDepth(false)
                          setExpandedAncestor(null)
                        }}
                        className="shrink-0 text-xs px-1.5 py-1 rounded bg-curtn-coral/20 text-curtn-coral hover:bg-curtn-coral/30"
                      >
                        Use
                      </button>
                    </div>
                    {isExpanded && a.siblings && (
                      <div className="ml-3 mt-1 space-y-1 border-l-2 border-curtn-dark/20 pl-2">
                        {a.siblings.filter(s => !s.isCurrent).map((s, si) => (
                          <div key={si} className="flex items-center gap-1">
                            <button
                              onClick={() => onInspect?.(s.selector)}
                              className="flex-1 text-left text-xs px-2 py-1 rounded bg-curtn-deep/50 hover:bg-curtn-dark/40 transition-colors"
                              title="Drill into this sibling"
                            >
                              <span className="text-curtn-coral">&lt;{s.tagName}&gt;</span>
                              <span className="text-curtn-muted ml-1">
                                {s.textContent.substring(0, 40)}{s.textContent.length > 40 ? '…' : ''}
                              </span>
                            </button>
                            <button
                              onClick={() => {
                                onNavigate?.(s.selector, s.textContent)
                                setShowDepth(false)
                                setExpandedAncestor(null)
                              }}
                              className="shrink-0 text-xs px-1.5 py-1 rounded bg-curtn-coral/20 text-curtn-coral hover:bg-curtn-coral/30"
                            >
                              Use
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          {/* Children (↓ narrower) */}
          {children && children.length > 0 && (
            <div className="space-y-1">
              <p className="text-xs text-curtn-muted/60">↓ Narrower (child elements)</p>
              {children.map((c, i) => (
                <div key={i} className="flex items-center gap-1">
                  <button
                    onClick={() => onInspect?.(c.selector)}
                    className="flex-1 text-left text-xs px-2 py-1.5 rounded bg-curtn-deep hover:bg-curtn-dark/40 transition-colors"
                    title="Drill into this element"
                  >
                    <span className="text-curtn-coral">&lt;{c.tagName}&gt;</span>
                    <span className="text-curtn-muted ml-1">
                      {c.textContent.substring(0, 40)}{c.textContent.length > 40 ? '…' : ''}
                    </span>
                    {c.childCount > 0 && (
                      <span className="text-curtn-muted/40 ml-1">({c.childCount} children)</span>
                    )}
                  </button>
                  <button
                    onClick={() => {
                      onNavigate?.(c.selector, c.textContent)
                      setShowDepth(false)
                      setExpandedAncestor(null)
                    }}
                    className="shrink-0 text-xs px-1.5 py-1 rounded bg-curtn-coral/20 text-curtn-coral hover:bg-curtn-coral/30"
                  >
                    Use
                  </button>
                </div>
              ))}
            </div>
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
