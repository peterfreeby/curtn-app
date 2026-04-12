"use client"

import { useState } from "react"
import { Button } from "@/components/Button"
import { FieldNodeRow, FieldNodeData } from "./FieldNodeRow"
import { ContainerNodeRow, ContainerNodeData } from "./ContainerNodeRow"
import { FieldPicker } from "./FieldPicker"

export type TemplateNodeUI = FieldNodeData | ContainerNodeData

interface TemplateNodeTreeProps {
  nodes: TemplateNodeUI[]
  activeNodeId: string | null
  previewTexts: Record<string, string>
  onSetActive: (id: string | null) => void
  onUpdateNode: (id: string, updates: any) => void
  onDeleteNode: (id: string) => void
  onAddField: (parentId: string | null, csvField: string) => void
  onAddContainer: (parentId: string | null) => void
  onInspect?: (selector: string, nodeId: string) => void
  depth?: number
  parentId?: string | null
}

function getUsedFields(nodes: TemplateNodeUI[]): Set<string> {
  const used = new Set<string>()
  for (const node of nodes) {
    if (node.type === 'field') used.add(node.csvField)
  }
  return used
}

export function TemplateNodeTree({
  nodes,
  activeNodeId,
  previewTexts,
  onSetActive,
  onUpdateNode,
  onDeleteNode,
  onAddField,
  onAddContainer,
  onInspect,
  depth = 0,
  parentId = null
}: TemplateNodeTreeProps) {
  const [showFieldPicker, setShowFieldPicker] = useState(false)
  const [expandedContainers, setExpandedContainers] = useState<Set<string>>(new Set(nodes.filter(n => n.type === 'container').map(n => n.id)))

  const usedFields = getUsedFields(nodes)
  const indent = depth > 0

  return (
    <div className={`space-y-2 ${indent ? 'border-l-2 border-curtn-dark/15 pl-2' : ''}`}>
      {nodes.map(node => {
        if (node.type === 'field') {
          return (
            <FieldNodeRow
              key={node.id}
              node={node}
              isActive={activeNodeId === node.id}
              previewText={previewTexts[node.id]}
              onActivate={() => onSetActive(activeNodeId === node.id ? null : node.id)}
              onUpdate={updates => onUpdateNode(node.id, updates)}
              onDelete={() => onDeleteNode(node.id)}
              onInspect={selector => onInspect?.(selector, node.id)}
            />
          )
        }

        if (node.type === 'container') {
          const isExpanded = expandedContainers.has(node.id)
          return (
            <ContainerNodeRow
              key={node.id}
              node={node as ContainerNodeData}
              isActive={activeNodeId === node.id}
              isExpanded={isExpanded}
              onToggleExpand={() => {
                setExpandedContainers(prev => {
                  const next = new Set(prev)
                  if (next.has(node.id)) next.delete(node.id)
                  else next.add(node.id)
                  return next
                })
              }}
              onActivate={() => onSetActive(activeNodeId === node.id ? null : node.id)}
              onUpdate={updates => onUpdateNode(node.id, updates)}
              onDelete={() => onDeleteNode(node.id)}
              onInspect={selector => onInspect?.(selector, node.id)}
            >
              <TemplateNodeTree
                nodes={(node as ContainerNodeData).children}
                activeNodeId={activeNodeId}
                previewTexts={previewTexts}
                onSetActive={onSetActive}
                onUpdateNode={onUpdateNode}
                onDeleteNode={onDeleteNode}
                onAddField={onAddField}
                onAddContainer={onAddContainer}
                onInspect={onInspect}
                depth={depth + 1}
                parentId={node.id}
              />
            </ContainerNodeRow>
          )
        }

        return null
      })}

      {/* Add buttons */}
      <div className="flex gap-2 pt-1">
        {showFieldPicker ? (
          <div className="w-full">
            <FieldPicker
              usedFields={usedFields}
              onSelect={fieldKey => {
                onAddField(parentId, fieldKey)
                setShowFieldPicker(false)
              }}
              onCancel={() => setShowFieldPicker(false)}
            />
          </div>
        ) : (
          <>
            <Button
              variant="tertiary"
              size="sm"
              onClick={() => setShowFieldPicker(true)}
            >
              + Field
            </Button>
            <Button
              variant="tertiary"
              size="sm"
              onClick={() => onAddContainer(parentId)}
            >
              + Container
            </Button>
          </>
        )}
      </div>
    </div>
  )
}
