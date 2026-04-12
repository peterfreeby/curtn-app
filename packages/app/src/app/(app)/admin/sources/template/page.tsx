"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { useSearchParams } from "next/navigation"
import { useQuery, useMutation } from "urql"
import {
  TEST_PARSING_TEMPLATE_MUTATION,
  DATA_SOURCE_UPDATE_MUTATION,
  SCRAPE_URL_MUTATION,
  PICKER_VENUES_QUERY,
  PICKER_COMPANIES_QUERY,
} from "@/lib/graphql/admin"
import { Card } from "@/components/Card"
import { Button } from "@/components/Button"
import { RelationPicker, RelationOption } from "@/components/admin/RelationPicker"
import { TemplateFieldRow, SelectorRule, ElementInfo } from "@/components/admin/TemplateFieldRow"
import { TemplatePreviewTable } from "@/components/admin/TemplatePreviewTable"
import { useAuth } from "@/lib/auth/useAuth"

interface CreditSelectors {
  containerSelector: string
  nameSelector: string
  roleSelector?: string
  headshotSelector?: string
}

interface ParsingTemplate {
  selectors: Record<string, SelectorRule | undefined>
  cast?: CreditSelectors
  crew?: CreditSelectors
  listSelector?: string
  useJsonLd?: boolean
  cleanup?: Record<string, any>
}

interface Presets {
  venueName?: string
  companyName?: string
  stageName?: string
  performanceTypes?: string[]
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
  cast?: { name: string; role?: string; headshotUrl?: string }[] | null
  crew?: { name: string; role?: string; headshotUrl?: string }[] | null
}

const FIELD_DEFS = [
  { key: 'title', label: 'Title', required: true },
  { key: 'date', label: 'Date' },
  { key: 'time', label: 'Time' },
  { key: 'venue', label: 'Venue' },
  { key: 'description', label: 'Description' },
  { key: 'ticketUrl', label: 'Ticket URL' },
  { key: 'imageUrl', label: 'Image URL' },
  { key: 'price', label: 'Price' },
  { key: 'runTitle', label: 'Run Title' },
  { key: 'showDescription', label: 'Show Description' },
  { key: 'runDescription', label: 'Run Description' },
  { key: 'duration', label: 'Duration (min)' },
  { key: 'startDate', label: 'Run Start Date' },
  { key: 'endDate', label: 'Run End Date' },
] as const

const CAST_FIELD_DEFS = [
  { key: 'castContainer', label: 'Container' },
  { key: 'castName', label: 'Name' },
  { key: 'castRole', label: 'Role' },
  { key: 'castHeadshot', label: 'Headshot' },
] as const

const CREW_FIELD_DEFS = [
  { key: 'crewContainer', label: 'Container' },
  { key: 'crewName', label: 'Name' },
  { key: 'crewRole', label: 'Role' },
  { key: 'crewHeadshot', label: 'Headshot' },
] as const

const EMPTY_TEMPLATE: ParsingTemplate = {
  selectors: {}
}

export default function TemplateBuilderPage() {
  const searchParams = useSearchParams()
  const { user } = useAuth()
  const dataSourceId = searchParams.get("dataSourceId")

  const [sampleUrl, setSampleUrl] = useState(searchParams.get("sampleUrl") || "")
  const [loadedUrl, setLoadedUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [activeField, setActiveField] = useState<string | null>(null)
  const [template, setTemplate] = useState<ParsingTemplate>(EMPTY_TEMPLATE)
  const [previewTexts, setPreviewTexts] = useState<Record<string, string>>({})
  const [listMode, setListMode] = useState(false)
  const [selectingListContainer, setSelectingListContainer] = useState(false)
  const [jsonLdDetected, setJsonLdDetected] = useState(false)
  // Track ancestors/children from last click per field for depth navigation
  const [fieldDepthInfo, setFieldDepthInfo] = useState<Record<string, { ancestors: ElementInfo[]; children: ElementInfo[] }>>({})
  const [testResults, setTestResults] = useState<ParsedEvent[] | null>(null)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [presets, setPresets] = useState<Presets>({})

  const iframeRef = useRef<HTMLIFrameElement>(null)

  // Send a message to the iframe to inspect an element (triggers a simulated click → full context back)
  const inspectElement = useCallback((selector: string) => {
    iframeRef.current?.contentWindow?.postMessage(
      { type: 'CURTN_INSPECT_ELEMENT', selector },
      '*'
    )
  }, [])

  const [, testTemplate] = useMutation(TEST_PARSING_TEMPLATE_MUTATION)
  const [, updateDataSource] = useMutation(DATA_SOURCE_UPDATE_MUTATION)
  const [{ fetching: scraping }, executeScrape] = useMutation(SCRAPE_URL_MUTATION)

  // Picker queries for presets — search-driven so we find all entities
  const [venueSearch, setVenueSearch] = useState("")
  const [companySearch, setCompanySearch] = useState("")

  const [{ data: venueData, fetching: venuesFetching }] = useQuery({
    query: PICKER_VENUES_QUERY,
    variables: { first: 50, search: venueSearch || undefined }
  })
  const [{ data: companyData, fetching: companiesFetching }] = useQuery({
    query: PICKER_COMPANIES_QUERY,
    variables: { first: 50, search: companySearch || undefined }
  })

  const venueOptions: (RelationOption & { _name: string })[] = venueData?.venueList?.edges?.map((e: any) => ({
    id: e.node.id,
    label: e.node.name,
    sublabel: e.node.city || undefined,
    _name: e.node.name
  })) || []

  const companyOptions: (RelationOption & { _name: string })[] = companyData?.productionCompanyList?.edges?.map((e: any) => ({
    id: e.node.id,
    label: e.node.name,
    _name: e.node.name
  })) || []

  // Track selected entity names so we can save them even after search changes
  const [selectedVenueId, setSelectedVenueId] = useState<string | null>(null)
  const [selectedVenueName, setSelectedVenueName] = useState<string | null>(null)
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null)
  const [selectedCompanyName, setSelectedCompanyName] = useState<string | null>(null)

  function handleVenueSelect(id: string | null) {
    setSelectedVenueId(id)
    setSelectedVenueName(id ? venueOptions.find(o => o.id === id)?._name || null : null)
  }
  function handleCompanySelect(id: string | null) {
    setSelectedCompanyId(id)
    setSelectedCompanyName(id ? companyOptions.find(o => o.id === id)?._name || null : null)
  }

  // Listen for postMessage from iframe bridge script
  // Map credit field keys to template.credits properties
  function applyFieldSelection(fieldKey: string, selector: string, textContent: string, ancestors: ElementInfo[], children: ElementInfo[]) {
    // Store depth info for this field
    setFieldDepthInfo(prev => ({ ...prev, [fieldKey]: { ancestors, children } }))
    setPreviewTexts(prev => ({ ...prev, [fieldKey]: textContent }))

    // Cast/crew fields map to template.cast / template.crew
    const castCrewMatch = fieldKey.match(/^(cast|crew)(Container|Name|Role|Headshot)$/)
    if (castCrewMatch) {
      const group = castCrewMatch[1] as 'cast' | 'crew'
      const prop = castCrewMatch[2] === 'Container' ? 'containerSelector'
        : castCrewMatch[2] === 'Name' ? 'nameSelector'
        : castCrewMatch[2] === 'Role' ? 'roleSelector'
        : 'headshotSelector'
      setTemplate(prev => ({
        ...prev,
        [group]: { ...prev[group] || { containerSelector: '', nameSelector: '' }, [prop]: selector }
      }))
    } else {
      // Regular field
      setTemplate(prev => ({
        ...prev,
        selectors: { ...prev.selectors, [fieldKey]: { selector } }
      }))
    }
  }

  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      if (event.data?.type !== 'CURTN_ELEMENT_SELECTED') return

      const { selector, textContent, ancestors, children } = event.data

      if (selectingListContainer) {
        setTemplate(prev => ({ ...prev, listSelector: selector }))
        setSelectingListContainer(false)
        setMessage({ type: 'success', text: `List container set: ${selector}` })
        return
      }

      if (!activeField) return

      applyFieldSelection(activeField, selector, textContent, ancestors || [], children || [])

      // Auto-advance to next unmapped field (only for regular fields)
      const currentIndex = FIELD_DEFS.findIndex(f => f.key === activeField)
      if (currentIndex >= 0) {
        const nextField = FIELD_DEFS.slice(currentIndex + 1).find(
          f => !template.selectors[f.key]?.selector
        )
        setActiveField(nextField?.key || null)
      } else {
        setActiveField(null)
      }
    }

    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [activeField, selectingListContainer, template.selectors])

  const loadPage = useCallback(async () => {
    if (!sampleUrl.trim()) return
    setLoading(true)
    setMessage(null)
    setTestResults(null)

    try {
      // Load iframe
      setLoadedUrl(sampleUrl.trim())

      // Check for JSON-LD
      const result = await testTemplate({
        input: {
          url: sampleUrl.trim(),
          template: JSON.stringify({ selectors: { title: { selector: 'h1' } }, useJsonLd: true })
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

  const useJsonLd = useCallback(() => {
    setTemplate(prev => ({ ...prev, useJsonLd: true }))
    setMessage({ type: 'success', text: 'JSON-LD extraction enabled. Test the template to see results.' })
  }, [])

  const handleTest = useCallback(async () => {
    if (!sampleUrl.trim()) return

    const hasSelectors = Object.values(template.selectors).some(r => r?.selector)
    if (!hasSelectors && !template.useJsonLd) {
      setMessage({ type: 'error', text: 'Map at least one field or enable JSON-LD before testing' })
      return
    }

    setMessage(null)
    const templateJson = JSON.stringify({
      ...template,
      selectors: Object.fromEntries(
        Object.entries(template.selectors).filter(([, v]) => v?.selector)
      )
    })

    const result = await testTemplate({
      input: { url: sampleUrl.trim(), template: templateJson }
    })

    if (result.data?.testParsingTemplate?.error) {
      setMessage({ type: 'error', text: result.data.testParsingTemplate.error })
    } else if (result.data?.testParsingTemplate?.events) {
      setTestResults(result.data.testParsingTemplate.events)
      setMessage({
        type: 'success',
        text: `Extracted ${result.data.testParsingTemplate.events.length} event(s)`
      })
    }
  }, [sampleUrl, template, testTemplate])

  const handleSave = useCallback(async () => {
    if (!dataSourceId) {
      setMessage({ type: 'error', text: 'No data source ID — open this page from the sources list' })
      return
    }

    // Decode the global ID to get the MongoDB ID
    let mongoId = dataSourceId
    try {
      const decoded = atob(dataSourceId)
      if (decoded.includes(':')) {
        mongoId = decoded.split(':')[1]
      }
    } catch {
      // Already a plain ID
    }

    const cleanTemplate = {
      ...template,
      selectors: Object.fromEntries(
        Object.entries(template.selectors).filter(([, v]) => v?.selector)
      )
    }

    // Build presets from selected entities
    const activePresets: Presets = {}
    if (selectedVenueName) activePresets.venueName = selectedVenueName
    if (selectedCompanyName) activePresets.companyName = selectedCompanyName
    if (presets.stageName) activePresets.stageName = presets.stageName
    if (presets.performanceTypes?.length) activePresets.performanceTypes = presets.performanceTypes

    const config = JSON.stringify({
      parsingTemplate: cleanTemplate,
      ...(Object.keys(activePresets).length > 0 ? { presets: activePresets } : {})
    })
    const result = await updateDataSource({
      input: { dataSourceId: mongoId, config }
    })

    if (result.data?.dataSourceUpdate?.error) {
      setMessage({ type: 'error', text: result.data.dataSourceUpdate.error })
    } else {
      setMessage({ type: 'success', text: 'Template saved to data source' })
    }
  }, [dataSourceId, template, selectedVenueName, selectedCompanyName, presets, updateDataSource])

  const handleScrape = useCallback(async () => {
    if (!sampleUrl.trim()) return

    const cleanTemplate = {
      ...template,
      selectors: Object.fromEntries(
        Object.entries(template.selectors).filter(([, v]) => v?.selector)
      )
    }

    const hasSelectors = Object.values(cleanTemplate.selectors).some(r => (r as any)?.selector)
    if (!hasSelectors && !template.useJsonLd) {
      setMessage({ type: 'error', text: 'Configure a template or enable JSON-LD before scraping' })
      return
    }

    // Decode dataSourceId if present
    let mongoId: string | undefined
    if (dataSourceId) {
      try {
        const decoded = atob(dataSourceId)
        mongoId = decoded.includes(':') ? decoded.split(':')[1] : dataSourceId
      } catch {
        mongoId = dataSourceId
      }
    }

    const result = await executeScrape({
      input: {
        url: sampleUrl.trim(),
        ...(mongoId && { dataSourceId: mongoId }),
        template: JSON.stringify(cleanTemplate)
      }
    })

    const data = result.data?.scrapeUrl
    if (data?.error) {
      setMessage({ type: 'error', text: data.error })
    } else if (data) {
      setMessage({
        type: 'success',
        text: `Scraped: ${data.eventsFound} found, ${data.eventsCreated} imported to pending review`
      })
    }
  }, [sampleUrl, template, dataSourceId, executeScrape])

  // Build the iframe URL with auth token
  const [iframeSrc, setIframeSrc] = useState<string | null>(null)
  useEffect(() => {
    if (!loadedUrl) {
      setIframeSrc(null)
      return
    }
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

  const activeFieldLabel = activeField
    ? (FIELD_DEFS.find(f => f.key === activeField)?.label
      || CAST_FIELD_DEFS.find(f => f.key === activeField)?.label
      || CREW_FIELD_DEFS.find(f => f.key === activeField)?.label
      || activeField)
    : null

  const statusText = selectingListContainer
    ? 'Click the repeating container element (e.g., the card or row that wraps each event)'
    : activeFieldLabel
      ? `Click the ${activeFieldLabel.toUpperCase()} element on the page`
      : 'Select a field in the sidebar, then click the matching element on the page'

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-curtn-cream">Template Builder</h1>
        <p className="text-sm text-curtn-muted mt-1">
          Load a sample page, then click elements to map them to event fields.
        </p>
      </div>

      {message && (
        <div className={`text-sm px-3 py-2 rounded ${
          message.type === 'error' ? 'bg-curtn-red/20 text-curtn-red' : 'bg-green-900/30 text-green-400'
        }`}>
          {message.text}
        </div>
      )}

      {/* URL input bar */}
      <Card>
        <div className="flex gap-2 items-end">
          <div className="flex-1">
            <label className="text-xs text-curtn-muted block mb-1">Sample Page URL</label>
            <input
              type="url"
              value={sampleUrl}
              onChange={e => setSampleUrl(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && loadPage()}
              placeholder="https://www.eventbrite.com/e/some-event-123"
              className="w-full bg-curtn-deep border border-curtn-dark/30 rounded px-3 py-2 text-sm text-curtn-cream focus:border-curtn-coral outline-none"
            />
          </div>
          <Button variant="primary" onClick={loadPage} disabled={loading || !sampleUrl.trim()}>
            {loading ? 'Loading...' : 'Load Page'}
          </Button>
        </div>
      </Card>

      {/* JSON-LD detection banner */}
      {jsonLdDetected && !template.useJsonLd && (
        <div className="flex items-center justify-between bg-curtn-coral/10 border border-curtn-coral/30 rounded px-4 py-3">
          <div>
            <p className="text-sm font-medium text-curtn-cream">Structured event data detected</p>
            <p className="text-xs text-curtn-muted">This page has JSON-LD schema.org data. You can auto-extract fields without manual selection.</p>
          </div>
          <Button variant="primary" size="sm" onClick={useJsonLd}>
            Use It
          </Button>
        </div>
      )}

      {template.useJsonLd && (
        <div className="flex items-center justify-between bg-green-900/20 border border-green-700/30 rounded px-4 py-3">
          <p className="text-sm text-green-400">JSON-LD extraction enabled. CSS selectors below are used as fallbacks.</p>
          <Button variant="tertiary" size="sm" onClick={() => setTemplate(prev => ({ ...prev, useJsonLd: false }))}>
            Disable
          </Button>
        </div>
      )}

      {/* Main two-column layout */}
      {loadedUrl && (
        <div className="flex gap-4" style={{ height: 'calc(100vh - 340px)', minHeight: '400px' }}>
          {/* Left: iframe preview */}
          <div className="flex-[7] flex flex-col min-w-0">
            <div className="text-xs text-curtn-coral font-medium mb-2 h-5">
              {statusText}
            </div>
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

          {/* Right: field mapping sidebar */}
          <div className="flex-[3] flex flex-col min-w-0">
            <div className="flex-1 overflow-y-auto space-y-2">
              {/* List mode toggle */}
              <div className="flex items-center gap-2 pb-2 border-b border-curtn-dark/20 mb-2">
                <label className="flex items-center gap-2 text-sm text-curtn-cream cursor-pointer">
                  <input
                    type="checkbox"
                    checked={listMode}
                    onChange={e => {
                      setListMode(e.target.checked)
                      if (!e.target.checked) {
                        setTemplate(prev => ({ ...prev, listSelector: undefined }))
                      }
                    }}
                    className="accent-curtn-coral"
                  />
                  Multiple events on page
                </label>
              </div>

              {listMode && (
                <div className={`border rounded p-3 mb-2 ${
                  selectingListContainer ? 'border-curtn-coral bg-curtn-coral/5' : 'border-curtn-dark/30'
                }`}>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-curtn-cream">List Container</span>
                    <Button
                      variant={selectingListContainer ? "primary" : "secondary"}
                      size="sm"
                      onClick={() => {
                        setSelectingListContainer(!selectingListContainer)
                        setActiveField(null)
                      }}
                    >
                      {selectingListContainer ? 'Selecting...' : template.listSelector ? 'Re-select' : 'Select'}
                    </Button>
                  </div>
                  {template.listSelector && (
                    <code className="text-xs text-curtn-muted bg-curtn-deep px-2 py-1 rounded block mt-2 overflow-x-auto">
                      {template.listSelector}
                    </code>
                  )}
                </div>
              )}

              {/* Field rows */}
              {FIELD_DEFS.map(field => (
                <TemplateFieldRow
                  key={field.key}
                  fieldName={field.key}
                  label={field.label}
                  required={'required' in field ? field.required : false}
                  rule={template.selectors[field.key]}
                  isActive={activeField === field.key}
                  previewText={previewTexts[field.key] || null}
                  ancestors={fieldDepthInfo[field.key]?.ancestors}
                  children={fieldDepthInfo[field.key]?.children}
                  onActivate={() => {
                    setActiveField(activeField === field.key ? null : field.key)
                    setSelectingListContainer(false)
                  }}
                  onClear={() => {
                    setTemplate(prev => ({
                      ...prev,
                      selectors: { ...prev.selectors, [field.key]: undefined }
                    }))
                    setPreviewTexts(prev => {
                      const next = { ...prev }
                      delete next[field.key]
                      return next
                    })
                  }}
                  onUpdateRule={rule => {
                    setTemplate(prev => ({
                      ...prev,
                      selectors: { ...prev.selectors, [field.key]: rule }
                    }))
                  }}
                  onNavigate={(selector, textContent) => {
                    applyFieldSelection(field.key, selector, textContent, [], [])
                  }}
                  onInspect={inspectElement}
                />
              ))}

              {/* Cast and Crew — separate selector groups */}
              {[
                { group: 'cast' as const, label: 'Cast', fields: CAST_FIELD_DEFS },
                { group: 'crew' as const, label: 'Crew', fields: CREW_FIELD_DEFS },
              ].map(({ group, label, fields }) => (
                <div key={group} className="border-t border-curtn-dark/20 pt-3 mt-3">
                  <h3 className="text-xs font-medium text-curtn-muted uppercase tracking-wide mb-2">
                    {label}
                  </h3>
                  <div className="space-y-2">
                    {fields.map(field => {
                      const propMap: Record<string, keyof CreditSelectors> = {
                        [`${group}Container`]: 'containerSelector',
                        [`${group}Name`]: 'nameSelector',
                        [`${group}Role`]: 'roleSelector',
                        [`${group}Headshot`]: 'headshotSelector',
                      }
                      const prop = propMap[field.key]
                      const selectorValue = prop ? template[group]?.[prop] : undefined
                      const rule = selectorValue ? { selector: selectorValue } : undefined

                      return (
                        <TemplateFieldRow
                          key={field.key}
                          fieldName={field.key}
                          label={field.label}
                          rule={rule}
                          isActive={activeField === field.key}
                          previewText={previewTexts[field.key] || null}
                          ancestors={fieldDepthInfo[field.key]?.ancestors}
                          children={fieldDepthInfo[field.key]?.children}
                          onActivate={() => {
                            setActiveField(activeField === field.key ? null : field.key)
                            setSelectingListContainer(false)
                          }}
                          onClear={() => {
                            setTemplate(prev => {
                              if (!prev[group]) return prev
                              const updated = { ...prev[group]! }
                              if (prop === 'containerSelector') updated.containerSelector = ''
                              else if (prop === 'nameSelector') updated.nameSelector = ''
                              else (updated as any)[prop] = undefined
                              if (!updated.containerSelector && !updated.nameSelector) {
                                return { ...prev, [group]: undefined }
                              }
                              return { ...prev, [group]: updated }
                            })
                            setPreviewTexts(prev => {
                              const next = { ...prev }
                              delete next[field.key]
                              return next
                            })
                          }}
                          onUpdateRule={rule => {
                            applyFieldSelection(field.key, rule.selector, previewTexts[field.key] || '', [], [])
                          }}
                          onNavigate={(selector, textContent) => {
                            applyFieldSelection(field.key, selector, textContent, [], [])
                          }}
                          onInspect={inspectElement}
                        />
                      )
                    })}
                  </div>
                </div>
              ))}

              {/* Presets — override fields with database entities */}
              <div className="border-t border-curtn-dark/20 pt-3 mt-3">
                <h3 className="text-xs font-medium text-curtn-muted uppercase tracking-wide mb-2">
                  Presets
                </h3>
                <p className="text-xs text-curtn-muted/60 mb-3">
                  Set default values from your database. These override extracted values for every event from this source.
                </p>
                <div className="space-y-3">
                  <RelationPicker
                    label="Venue"
                    options={venueOptions}
                    value={selectedVenueId}
                    onChange={handleVenueSelect}
                    onSearch={setVenueSearch}
                    loading={venuesFetching}
                    placeholder="Search venues..."
                  />
                  <RelationPicker
                    label="Production Company"
                    options={companyOptions}
                    value={selectedCompanyId}
                    onChange={handleCompanySelect}
                    onSearch={setCompanySearch}
                    loading={companiesFetching}
                    placeholder="Search companies..."
                  />
                  <div>
                    <label className="block text-xs text-curtn-muted mb-1">Stage</label>
                    <input
                      type="text"
                      value={presets.stageName || ''}
                      onChange={e => setPresets(prev => ({ ...prev, stageName: e.target.value || undefined }))}
                      placeholder="e.g. Main Stage, Downstairs"
                      className="w-full bg-curtn-deep border border-curtn-dark/30 rounded px-3 py-2 text-sm text-curtn-cream focus:border-curtn-coral outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-curtn-muted mb-1">Performance Types</label>
                    <input
                      type="text"
                      value={presets.performanceTypes?.join(', ') || ''}
                      onChange={e => setPresets(prev => ({
                        ...prev,
                        performanceTypes: e.target.value ? e.target.value.split(',').map(s => s.trim()).filter(Boolean) : undefined
                      }))}
                      placeholder="e.g. comedy, cabaret, music"
                      className="w-full bg-curtn-deep border border-curtn-dark/30 rounded px-3 py-2 text-sm text-curtn-cream focus:border-curtn-coral outline-none"
                    />
                    <p className="text-xs text-curtn-muted/40 mt-1">Comma-separated</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Bottom action bar */}
            <div className="border-t border-curtn-dark/20 pt-3 mt-3 space-y-2">
              <Button variant="secondary" onClick={handleTest} className="w-full">
                Test Template
              </Button>
              <Button
                variant="secondary"
                onClick={handleScrape}
                disabled={scraping || !sampleUrl.trim()}
                className="w-full"
              >
                {scraping ? 'Scraping...' : 'Scrape This Page'}
              </Button>
              {dataSourceId && (
                <Button variant="primary" onClick={handleSave} className="w-full">
                  Save Template
                </Button>
              )}
              {!dataSourceId && (
                <p className="text-xs text-curtn-muted text-center">
                  Open from a data source to save the template
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Test results */}
      {testResults && (
        <Card>
          <h3 className="text-sm font-medium text-curtn-cream mb-3">Extraction Results</h3>
          <TemplatePreviewTable events={testResults} />
        </Card>
      )}

      {/* Current template JSON (collapsible debug view) */}
      {Object.values(template.selectors).some(r => r?.selector) && (
        <details className="text-xs">
          <summary className="text-curtn-muted cursor-pointer hover:text-curtn-cream">
            View template JSON
          </summary>
          <pre className="mt-2 bg-curtn-deep p-3 rounded overflow-x-auto text-curtn-muted">
            {JSON.stringify({
              ...template,
              selectors: Object.fromEntries(
                Object.entries(template.selectors).filter(([, v]) => v?.selector)
              )
            }, null, 2)}
          </pre>
        </details>
      )}
    </div>
  )
}
