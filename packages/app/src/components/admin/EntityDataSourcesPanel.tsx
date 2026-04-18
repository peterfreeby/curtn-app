"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation } from "urql";
import {
  DATA_SOURCE_LIST_QUERY,
  DATA_SOURCE_CREATE_MUTATION,
  DATA_SOURCE_UPDATE_MUTATION,
  DATA_SOURCE_DELETE_MUTATION,
  POLL_DATA_SOURCE_MUTATION,
} from "@/lib/graphql/admin";
import { Button } from "@/components/Button";

type EntityType = "venue" | "company" | "show" | "run";

interface EntityDataSourcesPanelProps {
  entityType: EntityType;
  entityId: string; // Global Relay ID (base64)
}

interface SourceNode {
  id: string;
  name: string;
  type: string;
  url: string | null;
  config: string | null;
  isActive: boolean;
  lastPolledAt: string | null;
}

function decodeId(globalId: string): string {
  return atob(globalId).split(":")[1];
}

function hasTemplate(configJson: string | null): boolean {
  if (!configJson) return false;
  try {
    const config = JSON.parse(configJson);
    return !!config.parsingTemplate;
  } catch {
    return false;
  }
}

function isRecentlyPolled(lastPolledAt: string | null): boolean {
  if (!lastPolledAt) return false;
  return Date.now() - new Date(lastPolledAt).getTime() < 60 * 60 * 1000;
}

const associationInputKey: Record<EntityType, string> = {
  venue: "associatedVenueId",
  company: "associatedCompanyId",
  show: "associatedShowId",
  run: "associatedRunId",
};

const associationFilterKey: Record<EntityType, string> = {
  venue: "associatedVenueId",
  company: "associatedCompanyId",
  show: "associatedShowId",
  run: "associatedRunId",
};

export function EntityDataSourcesPanel({ entityType, entityId }: EntityDataSourcesPanelProps) {
  const router = useRouter();
  const mongoId = decodeId(entityId);

  const [{ data, fetching }, reexecuteQuery] = useQuery({
    query: DATA_SOURCE_LIST_QUERY,
    variables: { first: 50, [associationFilterKey[entityType]]: mongoId },
  });

  const [{ fetching: creating }, executeCreate] = useMutation(DATA_SOURCE_CREATE_MUTATION);
  const [{ fetching: updating }, executeUpdate] = useMutation(DATA_SOURCE_UPDATE_MUTATION);
  const [{ fetching: polling }, executePoll] = useMutation(POLL_DATA_SOURCE_MUTATION);
  const [{ fetching: deleting }, executeDelete] = useMutation(DATA_SOURCE_DELETE_MUTATION);

  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newType, setNewType] = useState<"rss" | "ical" | "web" | "url">("url");
  const [newUrl, setNewUrl] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  const [editingUrlId, setEditingUrlId] = useState<string | null>(null);
  const [editingUrlValue, setEditingUrlValue] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const sources: SourceNode[] = data?.dataSourceList?.edges?.map((e: any) => e.node) || [];

  async function handleCreate() {
    setMessage(null);
    const result = await executeCreate({
      input: {
        name: newName.trim(),
        type: newType,
        url: newUrl.trim() || undefined,
        config: "{}",
        isActive: true,
        [associationInputKey[entityType]]: mongoId,
      },
    });
    if (result.data?.dataSourceCreate?.dataSource) {
      setShowCreate(false);
      setNewName("");
      setNewUrl("");
      reexecuteQuery({ requestPolicy: "network-only" });
    } else {
      setMessage(result.data?.dataSourceCreate?.error || result.error?.message || "Failed to create");
    }
  }

  async function handleSaveUrl(sourceId: string) {
    setMessage(null);
    const result = await executeUpdate({
      input: { dataSourceId: decodeId(sourceId), url: editingUrlValue.trim() },
    });
    if (result.data?.dataSourceUpdate?.error) {
      setMessage(`Update failed: ${result.data.dataSourceUpdate.error}`);
    } else {
      setEditingUrlId(null);
      setEditingUrlValue("");
      reexecuteQuery({ requestPolicy: "network-only" });
    }
  }

  async function handlePoll(sourceId: string, sourceName: string) {
    setMessage(null);
    const result = await executePoll({ input: { dataSourceId: decodeId(sourceId) } });
    const payload = result.data?.pollDataSource;
    if (payload?.error) {
      setMessage(`${sourceName}: ${payload.error}`);
    } else if (payload) {
      setMessage(
        `${sourceName}: ${payload.eventsFound} found, ${payload.eventsCreated} new, ${payload.eventsSkipped} skipped`
      );
      reexecuteQuery({ requestPolicy: "network-only" });
    }
  }

  async function handleDelete(sourceId: string, sourceName: string) {
    setMessage(null);
    const result = await executeDelete({ input: { dataSourceId: decodeId(sourceId) } });
    const payload = result.data?.dataSourceDelete;
    if (payload?.error) {
      setMessage(`Delete failed: ${payload.error}`);
    } else {
      setMessage(`Deleted "${sourceName}"`);
      reexecuteQuery({ requestPolicy: "network-only" });
    }
    setConfirmDeleteId(null);
  }

  return (
    <div className="border border-curtn-dark/40 rounded p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xs uppercase tracking-widest text-curtn-muted">Data Sources</h3>
          <p className="text-xs text-curtn-muted/60 mt-0.5">
            Feeds and pages attached to this {entityType}.
          </p>
        </div>
        <Button variant="tertiary" size="sm" onClick={() => setShowCreate(!showCreate)}>
          {showCreate ? "Cancel" : "+ Add Source"}
        </Button>
      </div>

      {message && (
        <p className="text-xs text-curtn-coral">{message}</p>
      )}

      {showCreate && (
        <div className="space-y-2 bg-curtn-deep/40 p-3 rounded">
          <div className="grid gap-2 sm:grid-cols-2">
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Source name"
              className="w-full rounded border border-curtn-dark bg-curtn-deep px-2 py-1.5 text-sm text-curtn-cream focus:border-curtn-coral focus:outline-none"
            />
            <select
              value={newType}
              onChange={(e) => setNewType(e.target.value as any)}
              className="w-full rounded border border-curtn-dark bg-curtn-deep px-2 py-1.5 text-sm text-curtn-cream focus:border-curtn-coral focus:outline-none"
            >
              <option value="url">URL (Direct Page)</option>
              <option value="rss">RSS Feed</option>
              <option value="ical">iCal Calendar</option>
              <option value="web">Web (Google Alerts)</option>
            </select>
          </div>
          <input
            value={newUrl}
            onChange={(e) => setNewUrl(e.target.value)}
            placeholder="https://..."
            className="w-full rounded border border-curtn-dark bg-curtn-deep px-2 py-1.5 text-sm text-curtn-cream font-mono focus:border-curtn-coral focus:outline-none"
          />
          <Button
            variant="primary"
            size="sm"
            onClick={handleCreate}
            disabled={creating || !newName.trim() || !newUrl.trim()}
          >
            {creating ? "Creating..." : "Create"}
          </Button>
        </div>
      )}

      {fetching && !data ? (
        <p className="text-xs text-curtn-muted">Loading sources...</p>
      ) : sources.length === 0 ? (
        <p className="text-xs text-curtn-muted/60 italic">No data sources attached.</p>
      ) : (
        <div className="space-y-2">
          {sources.map((source) => (
            <div
              key={source.id}
              className="flex items-center gap-2 bg-curtn-deep/30 rounded p-2"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-curtn-cream font-medium truncate">
                    {source.name}
                  </span>
                  <span className="shrink-0 rounded-full bg-curtn-dark px-2 py-0.5 text-[10px] text-curtn-muted uppercase">
                    {source.type}
                  </span>
                  {(source.type === "web" || source.type === "rss" || source.type === "url") && (
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] ${
                        hasTemplate(source.config)
                          ? "bg-green-900/30 text-green-400"
                          : "bg-curtn-dark/50 text-curtn-muted/60"
                      }`}
                    >
                      {hasTemplate(source.config) ? "template" : "no template"}
                    </span>
                  )}
                  <span
                    className={`shrink-0 h-1.5 w-1.5 rounded-full ${
                      source.isActive ? "bg-green-500" : "bg-curtn-muted/30"
                    }`}
                  />
                </div>
                {editingUrlId === source.id ? (
                  <div className="mt-1 flex items-center gap-1">
                    <input
                      value={editingUrlValue}
                      onChange={(e) => setEditingUrlValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && editingUrlValue.trim()) handleSaveUrl(source.id);
                        if (e.key === "Escape") {
                          setEditingUrlId(null);
                          setEditingUrlValue("");
                        }
                      }}
                      autoFocus
                      className="flex-1 rounded border border-curtn-dark bg-curtn-deep px-2 py-0.5 text-xs text-curtn-cream font-mono focus:border-curtn-coral focus:outline-none"
                    />
                    <button
                      onClick={() => handleSaveUrl(source.id)}
                      disabled={updating || !editingUrlValue.trim()}
                      className="text-xs px-2 py-0.5 rounded bg-curtn-coral/20 text-curtn-coral disabled:opacity-50"
                    >
                      Save
                    </button>
                    <button
                      onClick={() => {
                        setEditingUrlId(null);
                        setEditingUrlValue("");
                      }}
                      className="text-xs px-2 py-0.5 text-curtn-muted"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <div className="mt-0.5 flex items-center gap-2">
                    <span className="text-xs text-curtn-muted/60 truncate">
                      {source.url || <em>no url</em>}
                    </span>
                    <button
                      onClick={() => {
                        setEditingUrlId(source.id);
                        setEditingUrlValue(source.url || "");
                      }}
                      className="shrink-0 text-[10px] text-curtn-muted/50 hover:text-curtn-coral"
                    >
                      edit
                    </button>
                  </div>
                )}
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {(source.type === "web" || source.type === "rss" || source.type === "url") && (
                  <Button
                    variant="tertiary"
                    size="sm"
                    onClick={() =>
                      router.push(`/admin/sources/template?dataSourceId=${source.id}`)
                    }
                  >
                    {hasTemplate(source.config) ? "Edit Template" : "Template"}
                  </Button>
                )}
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => handlePoll(source.id, source.name)}
                  disabled={polling || isRecentlyPolled(source.lastPolledAt)}
                >
                  {polling
                    ? "..."
                    : isRecentlyPolled(source.lastPolledAt)
                    ? "Cooldown"
                    : "Poll"}
                </Button>
                {confirmDeleteId === source.id ? (
                  <>
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => handleDelete(source.id, source.name)}
                      disabled={deleting}
                    >
                      Confirm
                    </Button>
                    <button
                      onClick={() => setConfirmDeleteId(null)}
                      className="text-xs text-curtn-muted px-2"
                    >
                      Cancel
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => setConfirmDeleteId(source.id)}
                    className="text-xs text-curtn-muted/50 hover:text-curtn-red px-2"
                    title="Delete source"
                  >
                    ×
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
