"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { useSearchParams } from "next/navigation"
import { useQuery, useMutation } from "urql"
import {
  DATA_SOURCE_GET_QUERY,
  TEST_PARSING_TEMPLATE_MUTATION,
  DATA_SOURCE_UPDATE_MUTATION,
  SCRAPE_URL_MUTATION,
} from "@/lib/graphql/admin"
import { Card } from "@/components/Card"
import { Button } from "@/components/Button"
import { TemplateNodeTree, TemplateNodeUI } from "@/components/admin/templateV2/TemplateNodeTree"
import { V2PreviewTable } from "@/components/admin/templateV2/V2PreviewTable"
import { CSV_FIELD_LABELS } from "@/components/admin/templateV2/csvFieldGroups"
import { useAuth } from "@/lib/auth/useAuth"

type FlatRow = Record<string, string | undefined>

function generateId(): string {
  return Math.random().toString(36).slice(2, 10)
}

// Fields whose value is an image URL (take `src` when selecting an <img>)
const IMAGE_URL_FIELDS = new Set([
  'showImageUrl', 'showPosterUrl',
  'venueImageUrl',
  'runImageUrl', 'runPosterUrl',
  'companyLogoUrl', 'personHeadshotUrl',
  'performanceImageUrl',
])

// Fields whose value is a link URL (take `href` when selecting an <a>)
const LINK_URL_FIELDS = new Set([
  'showUrl', 'venueWebsite', 'ticketUrl',
])

function findNodeById(tree: TemplateNodeUI[], targetId: string): TemplateNodeUI | null {
  for (const node of tree) {
    if (node.id === targetId) return node
    if (node.type === 'container') {
      const found = findNodeById(node.children, targetId)
      if (found) return found
    }
  }
  return null
}

function inferAttribute(tagName: string | undefined, csvField: string | undefined): string | undefined {
  if (!tagName || !csvField) return undefined
  if (tagName === 'img' && IMAGE_URL_FIELDS.has(csvField)) return 'src'
  if (tagName === 'a' && LINK_URL_FIELDS.has(csvField)) return 'href'
  return undefined
}

export default function TemplateBuilderPage() {
  const searchParams = useSearchParams()
  const { user } = useAuth()
  const dataSourceId = searchParams.get("dataSourceId")

  const [sampleUrl, setSampleUrl] = useState(searchParams.get("sampleUrl") || "")
  const [loadedUrl, setLoadedUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [activeNodeId, setActiveNodeId] = useState<string | null>(null)
  const [nodes, setNodes] = useState<TemplateNodeUI[]>([])
  const [previewTexts, setPreviewTexts] = useState<Record<string, string>>({})
  const [useJsonLd, setUseJsonLd] = useState(false)
  const [jsonLdDetected, setJsonLdDetected] = useState(false)
  const [testResults, setTestResults] = useState<FlatRow[] | null>(null)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [configLoaded, setConfigLoaded] = useState(false)

  const iframeRef = useRef<HTMLIFrameElement>(null)

  const [, testTemplate] = useMutation(TEST_PARSING_TEMPLATE_MUTATION)
  const [, updateDataSource] = useMutation(DATA_SOURCE_UPDATE_MUTATION)
  const [{ fetching: scraping }, executeScrape] = useMutation(SCRAPE_URL_MUTATION)

  // Load existing config
  const [{ data: dsData }] = useQuery({
    query: DATA_SOURCE_GET_QUERY,
    variables: { id: dataSourceId || '' },
    pause: !dataSourceId
  })

  useEffect(() => {
    if (configLoaded || !dsData?.node?.config) return
    try {
      const config = JSON.parse(dsData.node.config)
      const tmpl = config.parsingTemplate
      if (tmpl?.version === 2 && tmpl.nodes) {
        setNodes(tmpl.nodes)
        if (tmpl.useJsonLd) setUseJsonLd(true)
      }
      // V1 templates: show migration banner (don't auto-convert)
    } catch { /* start fresh */ }
    setConfigLoaded(true)
  }, [dsData, configLoaded])

  // Inspect: ask iframe to simulate a click on a selector
  const inspectElement = useCallback((selector: string, nodeId?: string) => {
    if (nodeId) setActiveNodeId(nodeId)
    iframeRef.current?.contentWindow?.postMessage(
      { type: 'CURTN_INSPECT_ELEMENT', selector },
      '*'
    )
  }, [])

  // Find the parent container selector for a given node ID
  function findParentContainerSelector(tree: TemplateNodeUI[], targetId: string, parentSelector?: string): string | undefined {
    for (const node of tree) {
      if (node.id === targetId) return parentSelector
      if (node.type === 'container') {
        const found = findParentContainerSelector(node.children, targetId, node.selector || undefined)
        if (found !== undefined) return found
      }
    }
    return undefined
  }

  function findNodeType(tree: TemplateNodeUI[], targetId: string): 'field' | 'container' | null {
    for (const node of tree) {
      if (node.id === targetId) return node.type
      if (node.type === 'container') {
        const found = findNodeType(node.children, targetId)
        if (found) return found
      }
    }
    return null
  }

  // When active node changes, tell the iframe about the container scope + selection mode
  useEffect(() => {
    if (!activeNodeId || !iframeRef.current?.contentWindow) return
    const containerSelector = findParentContainerSelector(nodes, activeNodeId)
    const nodeType = findNodeType(nodes, activeNodeId)
    iframeRef.current.contentWindow.postMessage(
      { type: 'CURTN_SET_CONTAINER_SCOPE', containerSelector: containerSelector || null },
      '*'
    )
    iframeRef.current.contentWindow.postMessage(
      { type: 'CURTN_SET_SELECTION_MODE', mode: nodeType === 'container' ? 'container' : 'field' },
      '*'
    )
  }, [activeNodeId, nodes])

  // Listen for postMessage from iframe bridge
  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      if (event.data?.type !== 'CURTN_ELEMENT_SELECTED') return
      if (!activeNodeId) return

      // Use relativeSelector if the bridge generated one (scoped to container)
      const selector = event.data.relativeSelector || event.data.selector
      const textContent = event.data.textContent
      const tagName: string | undefined = event.data.tagName

      const active = findNodeById(nodes, activeNodeId)
      const updates: any = { selector }
      if (active?.type === 'field' && !active.attribute) {
        const inferred = inferAttribute(tagName, active.csvField)
        if (inferred) updates.attribute = inferred
      }

      setNodes(prev => updateNodeInTree(prev, activeNodeId, updates))
      setPreviewTexts(prev => ({ ...prev, [activeNodeId]: textContent }))
    }

    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [activeNodeId, nodes])

  // Tree mutation helpers
  function updateNodeInTree(tree: TemplateNodeUI[], id: string, updates: any): TemplateNodeUI[] {
    return tree.map(node => {
      if (node.id === id) {
        return { ...node, ...updates }
      }
      if (node.type === 'container') {
        return { ...node, children: updateNodeInTree(node.children, id, updates) }
      }
      return node
    })
  }

  function deleteNodeFromTree(tree: TemplateNodeUI[], id: string): TemplateNodeUI[] {
    return tree
      .filter(node => node.id !== id)
      .map(node => {
        if (node.type === 'container') {
          return { ...node, children: deleteNodeFromTree(node.children, id) }
        }
        return node
      })
  }

  function addNodeToTree(tree: TemplateNodeUI[], parentId: string | null, newNode: TemplateNodeUI): TemplateNodeUI[] {
    if (parentId === null) {
      return [...tree, newNode]
    }
    return tree.map(node => {
      if (node.id === parentId && node.type === 'container') {
        return { ...node, children: [...node.children, newNode] }
      }
      if (node.type === 'container') {
        return { ...node, children: addNodeToTree(node.children, parentId, newNode) }
      }
      return node
    })
  }

  const handleAddField = useCallback((parentId: string | null, csvField: string) => {
    const newNode: TemplateNodeUI = {
      type: 'field',
      id: generateId(),
      csvField,
    }
    setNodes(prev => addNodeToTree(prev, parentId, newNode))
  }, [])

  const handleAddContainer = useCallback((parentId: string | null) => {
    const newNode: TemplateNodeUI = {
      type: 'container',
      id: generateId(),
      label: 'New Container',
      selector: '',
      children: [],
    }
    setNodes(prev => addNodeToTree(prev, parentId, newNode))
  }, [])

  // Build the V2 template for serialization
  function buildTemplate() {
    return {
      version: 2 as const,
      nodes,
      ...(useJsonLd && { useJsonLd: true }),
    }
  }

  // Load page
  const loadPage = useCallback(async () => {
    if (!sampleUrl.trim()) return
    setLoading(true)
    setMessage(null)
    setTestResults(null)

    try {
      setLoadedUrl(sampleUrl.trim())

      // Check for JSON-LD
      const result = await testTemplate({
        input: {
          url: sampleUrl.trim(),
          template: JSON.stringify({ version: 2, nodes: [{ type: 'field', id: 'probe', csvField: 'title', selector: 'h1' }], useJsonLd: true })
        }
      })
      if (result.data?.testParsingTemplate?.jsonLdDetected) {
        setJsonLdDetected(true)
      }
    } catch {
      setMessage({ type: 'error', text: 'Failed to load page' })
    } finally {
      setLoading(false)
    }
  }, [sampleUrl, testTemplate])

  // Test
  const handleTest = useCallback(async () => {
    if (!sampleUrl.trim()) return
    if (nodes.length === 0 && !useJsonLd) {
      setMessage({ type: 'error', text: 'Add at least one field or enable JSON-LD' })
      return
    }

    setMessage(null)
    const result = await testTemplate({
      input: { url: sampleUrl.trim(), template: JSON.stringify(buildTemplate()) }
    })

    const data = result.data?.testParsingTemplate
    if (data?.error) {
      setMessage({ type: 'error', text: data.error })
    } else if (data?.flatRows) {
      const rows = JSON.parse(data.flatRows)
      setTestResults(rows)
      setMessage({ type: 'success', text: `Extracted ${rows.length} row(s)` })
    }
  }, [sampleUrl, nodes, useJsonLd, testTemplate])

  // Scrape
  const handleScrape = useCallback(async () => {
    if (!sampleUrl.trim()) return
    if (nodes.length === 0 && !useJsonLd) {
      setMessage({ type: 'error', text: 'Add at least one field or enable JSON-LD' })
      return
    }

    let mongoId: string | undefined
    if (dataSourceId) {
      try {
        const decoded = atob(dataSourceId)
        mongoId = decoded.includes(':') ? decoded.split(':')[1] : dataSourceId
      } catch { mongoId = dataSourceId }
    }

    const result = await executeScrape({
      input: {
        url: sampleUrl.trim(),
        ...(mongoId && { dataSourceId: mongoId }),
        template: JSON.stringify(buildTemplate())
      }
    })

    const data = result.data?.scrapeUrl
    if (data?.error) {
      setMessage({ type: 'error', text: data.error })
    } else if (data) {
      const parts = []
      if (data.showsCreated) parts.push(`${data.showsCreated} shows created`)
      if (data.showsMatched) parts.push(`${data.showsMatched} shows matched`)
      if (data.runsCreated) parts.push(`${data.runsCreated} runs`)
      if (data.performancesCreated) parts.push(`${data.performancesCreated} performances`)
      if (data.personsCreated) parts.push(`${data.personsCreated} people`)
      if (data.creditsCreated) parts.push(`${data.creditsCreated} credits`)
      setMessage({
        type: 'success',
        text: parts.length > 0
          ? `Imported: ${parts.join(', ')}`
          : `Scraped ${data.eventsFound} rows, ${data.eventsCreated} processed`
      })
    }
  }, [sampleUrl, nodes, useJsonLd, dataSourceId, executeScrape])

  // Save
  const handleSave = useCallback(async () => {
    if (!dataSourceId) return

    let mongoId = dataSourceId
    try {
      const decoded = atob(dataSourceId)
      if (decoded.includes(':')) mongoId = decoded.split(':')[1]
    } catch { /* already plain */ }

    const config = JSON.stringify({ parsingTemplate: buildTemplate() })
    const result = await updateDataSource({ input: { dataSourceId: mongoId, config } })

    if (result.data?.dataSourceUpdate?.error) {
      setMessage({ type: 'error', text: result.data.dataSourceUpdate.error })
    } else {
      setMessage({ type: 'success', text: 'Template saved' })
    }
  }, [dataSourceId, nodes, useJsonLd, updateDataSource])

  // Iframe src with auth token
  const [iframeSrc, setIframeSrc] = useState<string | null>(null)
  useEffect(() => {
    if (!loadedUrl) { setIframeSrc(null); return }
    async function buildSrc() {
      try {
        const { auth } = await import("@/lib/firebase/config")
        const token = await auth?.currentUser?.getIdToken()
        const tokenParam = token ? `&token=${encodeURIComponent(token)}` : ''
        setIframeSrc(`/api/admin/page-preview?url=${encodeURIComponent(loadedUrl!)}${tokenParam}`)
      } catch {
        setIframeSrc(`/api/admin/page-preview?url=${encodeURIComponent(loadedUrl!)}`)
      }
    }
    buildSrc()
  }, [loadedUrl])

  // Active node label for status text
  function getActiveLabel(): string | null {
    if (!activeNodeId) return null
    function findLabel(tree: TemplateNodeUI[]): string | null {
      for (const node of tree) {
        if (node.id === activeNodeId) {
          return node.type === 'field'
            ? CSV_FIELD_LABELS[node.csvField] || node.csvField
            : node.label
        }
        if (node.type === 'container') {
          const found = findLabel(node.children)
          if (found) return found
        }
      }
      return null
    }
    return findLabel(nodes)
  }

  const activeLabel = getActiveLabel()
  const statusText = activeLabel
    ? `Click the ${activeLabel.toUpperCase()} element on the page`
    : 'Select a field in the sidebar, then click the matching element on the page'

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-curtn-cream">Template Builder</h1>
        <p className="text-sm text-curtn-muted mt-1">
          Add fields from the data model, then map them to page elements.
        </p>
      </div>

      {message && (
        <div className={`text-sm px-3 py-2 rounded ${
          message.type === 'error' ? 'bg-curtn-red/20 text-curtn-red' : 'bg-green-900/30 text-green-400'
        }`}>
          {message.text}
        </div>
      )}

      {/* URL input */}
      <Card>
        <div className="flex gap-2 items-end">
          <div className="flex-1">
            <label className="text-xs text-curtn-muted block mb-1">Sample Page URL</label>
            <input
              type="url"
              value={sampleUrl}
              onChange={e => setSampleUrl(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && loadPage()}
              placeholder="https://www.pacnyc.org/whats-on/giulia/"
              className="w-full bg-curtn-deep border border-curtn-dark/30 rounded px-3 py-2 text-sm text-curtn-cream focus:border-curtn-coral outline-none"
            />
          </div>
          <Button variant="primary" onClick={loadPage} disabled={loading || !sampleUrl.trim()}>
            {loading ? 'Loading...' : 'Load Page'}
          </Button>
        </div>
      </Card>

      {/* JSON-LD banners */}
      {jsonLdDetected && !useJsonLd && (
        <div className="flex items-center justify-between bg-curtn-coral/10 border border-curtn-coral/30 rounded px-4 py-3">
          <div>
            <p className="text-sm font-medium text-curtn-cream">Structured event data detected</p>
            <p className="text-xs text-curtn-muted">JSON-LD schema.org data available — auto-extract without manual selectors.</p>
          </div>
          <Button variant="primary" size="sm" onClick={() => setUseJsonLd(true)}>Use It</Button>
        </div>
      )}
      {useJsonLd && (
        <div className="flex items-center justify-between bg-green-900/20 border border-green-700/30 rounded px-4 py-3">
          <p className="text-sm text-green-400">JSON-LD extraction enabled. CSS selectors below are fallbacks.</p>
          <Button variant="tertiary" size="sm" onClick={() => setUseJsonLd(false)}>Disable</Button>
        </div>
      )}

      {/* Main layout */}
      {loadedUrl && (
        <div className="flex gap-4" style={{ height: 'calc(100vh - 320px)', minHeight: '400px' }}>
          {/* Left: iframe */}
          <div className="flex-[7] flex flex-col min-w-0">
            <div className="text-xs text-curtn-coral font-medium mb-2 h-5">{statusText}</div>
            <div className="flex-1 border border-curtn-dark/30 rounded overflow-hidden bg-white">
              {iframeSrc && (
                <iframe
                  ref={iframeRef}
                  src={iframeSrc}
                  className="w-full h-full"
                  sandbox="allow-scripts allow-same-origin"
                  title="Page preview"
                />
              )}
            </div>
          </div>

          {/* Right: composable tree sidebar */}
          <div className="flex-[3] flex flex-col min-w-0">
            <div className="flex-1 overflow-y-auto">
              <TemplateNodeTree
                nodes={nodes}
                activeNodeId={activeNodeId}
                previewTexts={previewTexts}
                onSetActive={setActiveNodeId}
                onUpdateNode={(id, updates) => setNodes(prev => updateNodeInTree(prev, id, updates))}
                onDeleteNode={id => { setNodes(prev => deleteNodeFromTree(prev, id)); if (activeNodeId === id) setActiveNodeId(null) }}
                onAddField={handleAddField}
                onAddContainer={handleAddContainer}
                onInspect={(selector, nodeId) => inspectElement(selector, nodeId)}
              />
            </div>

            {/* Actions */}
            <div className="border-t border-curtn-dark/20 pt-3 mt-3 space-y-2">
              <Button variant="secondary" onClick={handleTest} className="w-full">
                Test Template
              </Button>
              <Button
                variant="secondary"
                onClick={handleScrape}
                disabled={scraping}
                className="w-full"
              >
                {scraping ? 'Importing...' : 'Import This Page'}
              </Button>
              {dataSourceId ? (
                <Button variant="primary" onClick={handleSave} className="w-full">
                  Save Template
                </Button>
              ) : (
                <p className="text-xs text-curtn-muted text-center">Open from a data source to save</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* If no page loaded yet, still show the tree for setup */}
      {!loadedUrl && (
        <Card>
          <p className="text-xs text-curtn-muted mb-3">Configure your template — load a page to use the visual selector.</p>
          <TemplateNodeTree
            nodes={nodes}
            activeNodeId={activeNodeId}
            previewTexts={previewTexts}
            onSetActive={setActiveNodeId}
            onUpdateNode={(id, updates) => setNodes(prev => updateNodeInTree(prev, id, updates))}
            onDeleteNode={id => setNodes(prev => deleteNodeFromTree(prev, id))}
            onAddField={handleAddField}
            onAddContainer={handleAddContainer}
          />
        </Card>
      )}

      {/* Test results */}
      {testResults && (
        <Card>
          <h3 className="text-sm font-medium text-curtn-cream mb-3">Extraction Results</h3>
          <V2PreviewTable rows={testResults} />
        </Card>
      )}

      {/* Template JSON debug */}
      {nodes.length > 0 && (
        <details className="text-xs">
          <summary className="text-curtn-muted cursor-pointer hover:text-curtn-cream">View template JSON</summary>
          <pre className="mt-2 bg-curtn-deep p-3 rounded overflow-x-auto text-curtn-muted">
            {JSON.stringify(buildTemplate(), null, 2)}
          </pre>
        </details>
      )}
    </div>
  )
}
