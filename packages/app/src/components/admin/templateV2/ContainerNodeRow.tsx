"use client"

import { useState } from "react"
import { Button } from "@/components/Button"

export interface ContainerNodeData {
  type: 'container'
  id: string
  label: string
  selector: string
  children: any[]
}

interface ContainerNodeRowProps {
  node: ContainerNodeData
  isActive: boolean
  isExpanded: boolean
  onToggleExpand: () => void
  onActivate: () => void
  onUpdate: (updates: Partial<ContainerNodeData>) => void
  onDelete: () => void
  onInspect?: (selector: string) => void
  children: React.ReactNode
}

export function ContainerNodeRow({
  node,
  isActive,
  isExpanded,
  onToggleExpand,
  onActivate,
  onUpdate,
  onDelete,
  onInspect,
  children
}: ContainerNodeRowProps) {
  const [editingSelector, setEditingSelector] = useState(false)
  const [selectorDraft, setSelectorDraft] = useState('')
  const [editingLabel, setEditingLabel] = useState(false)

  return (
    <div className={`border rounded ${isActive ? 'border-curtn-coral' : 'border-curtn-dark/30'}`}>
      {/* Container header */}
      <div className="flex items-center gap-2 p-2.5 bg-curtn-dark/20 rounded-t">
        <button
          onClick={onToggleExpand}
          className="text-xs text-curtn-muted hover:text-curtn-cream shrink-0"
        >
          {isExpanded ? '▼' : '▶'}
        </button>

        {editingLabel ? (
          <input
            type="text"
            value={node.label}
            onChange={e => onUpdate({ label: e.target.value })}
            onBlur={() => setEditingLabel(false)}
            onKeyDown={e => e.key === 'Enter' && setEditingLabel(false)}
            autoFocus
            className="flex-1 text-xs bg-curtn-deep border border-curtn-coral rounded px-2 py-0.5 text-curtn-cream font-medium focus:outline-none"
          />
        ) : (
          <button
            onClick={() => setEditingLabel(true)}
            className="flex-1 text-left text-xs font-medium text-curtn-cream hover:text-curtn-coral"
            title="Click to rename"
          >
            {node.label || 'Unnamed Container'}
          </button>
        )}

        <span className="text-xs text-curtn-muted/40">
          {node.children.length} {node.children.length === 1 ? 'item' : 'items'}
        </span>

        <button
          onClick={onDelete}
          className="text-xs text-curtn-muted/40 hover:text-curtn-red shrink-0"
          title="Remove container"
        >
          ×
        </button>
      </div>

      {/* Container selector */}
      <div className="px-2.5 py-2 border-b border-curtn-dark/10">
        {node.selector && !editingSelector ? (
          <div className="flex items-center gap-2">
            <span className="text-xs text-curtn-muted shrink-0">repeats:</span>
            <button
              onClick={() => { setSelectorDraft(node.selector); setEditingSelector(true) }}
              className="flex-1 text-xs text-curtn-muted bg-curtn-deep px-2 py-0.5 rounded font-mono text-left hover:bg-curtn-dark/40 cursor-text truncate"
            >
              {node.selector}
            </button>
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
              placeholder="CSS selector for repeating element"
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
              <button onClick={() => setEditingSelector(false)} className="text-xs text-curtn-muted">Cancel</button>
            </div>
          </div>
        ) : (
          <div className="flex gap-1.5">
            <Button
              variant={isActive ? "primary" : "secondary"}
              size="sm"
              onClick={onActivate}
            >
              {isActive ? 'Selecting...' : 'Select Container'}
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

      {/* Children */}
      {isExpanded && (
        <div className="p-2.5">
          {children}
        </div>
      )}
    </div>
  )
}
