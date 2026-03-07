"use client";

import { useState } from "react";
import { useQuery, useMutation } from "urql";
import {
  DATA_SOURCE_LIST_QUERY,
  DATA_SOURCE_CREATE_MUTATION,
  POLL_DATA_SOURCE_MUTATION,
} from "@/lib/graphql/admin";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";

interface DataSourceNode {
  id: string;
  name: string;
  type: string;
  url: string | null;
  isActive: boolean;
  lastPolledAt: string | null;
  createdAt: string;
}

/**
 * Normalize a feed URL:
 * - Google Calendar ID → full iCal URL
 * - webcal:// → https://
 * - Trim whitespace
 */
function normalizeFeedUrl(input: string): { url: string; detectedType?: "rss" | "ical"; hint?: string } {
  let trimmed = input.trim();

  // Google Calendar ID (contains @import.calendar.google.com or @group.calendar.google.com)
  if (trimmed.includes("@") && trimmed.includes("calendar.google.com") && !trimmed.startsWith("http")) {
    const encoded = encodeURIComponent(trimmed);
    return {
      url: `https://calendar.google.com/calendar/ical/${encoded}/public/basic.ics`,
      detectedType: "ical",
      hint: "Detected Google Calendar ID",
    };
  }

  // webcal:// → https://
  if (trimmed.startsWith("webcal://")) {
    trimmed = trimmed.replace(/^webcal:\/\//, "https://");
    return {
      url: trimmed,
      detectedType: "ical",
      hint: "Converted webcal:// to https://",
    };
  }

  // Auto-detect type from URL
  let detectedType: "rss" | "ical" | undefined;
  if (/\.ics($|\?)/.test(trimmed) || /ical/i.test(trimmed)) {
    detectedType = "ical";
  } else if (/\.rss($|\?)/.test(trimmed) || /\bfeed\b/i.test(trimmed) || /\.xml($|\?)/.test(trimmed)) {
    detectedType = "rss";
  }

  return { url: trimmed, detectedType };
}

export default function DataSourcesPage() {
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState("");
  const [type, setType] = useState<"rss" | "ical">("rss");
  const [url, setUrl] = useState("");
  const [urlHint, setUrlHint] = useState<string | null>(null);
  const [config, setConfig] = useState("");
  const [pollResult, setPollResult] = useState<string | null>(null);

  const [{ data, fetching }, reexecuteQuery] = useQuery({
    query: DATA_SOURCE_LIST_QUERY,
    variables: { first: 50 },
  });

  const [{ fetching: creating }, executeCreate] = useMutation(
    DATA_SOURCE_CREATE_MUTATION
  );
  const [{ fetching: polling }, executePoll] = useMutation(
    POLL_DATA_SOURCE_MUTATION
  );

  const sources: DataSourceNode[] =
    data?.dataSourceList?.edges?.map((e: any) => e.node) || [];

  async function handleCreate() {
    let parsedConfig = {};
    if (config.trim()) {
      try {
        parsedConfig = JSON.parse(config);
      } catch {
        setPollResult("Invalid JSON in config field");
        return;
      }
    }

    const result = await executeCreate({
      input: {
        name,
        type,
        url: url || undefined,
        config: JSON.stringify(parsedConfig),
        isActive: true,
      },
    });

    if (result.data?.dataSourceCreate?.dataSource) {
      setShowCreate(false);
      setName("");
      setUrl("");
      setConfig("");
      reexecuteQuery({ requestPolicy: "network-only" });
    } else {
      setPollResult(
        result.data?.dataSourceCreate?.error || result.error?.message || "Failed"
      );
    }
  }

  function isRecentlyPolled(lastPolledAt: string | null): boolean {
    if (!lastPolledAt) return false;
    return Date.now() - new Date(lastPolledAt).getTime() < 60 * 60 * 1000;
  }

  async function handlePoll(sourceId: string, sourceName: string) {
    setPollResult(null);
    // sourceId from GraphQL is a global ID like "RGF0YVNvdXJjZToxMjM0"
    // But our mutation expects a MongoDB ObjectId. We need to decode it.
    const decoded = atob(sourceId);
    const mongoId = decoded.split(":")[1];

    const result = await executePoll({
      input: { dataSourceId: mongoId },
    });

    const data = result.data?.pollDataSource;
    if (data?.error) {
      setPollResult(`${sourceName}: ${data.error}`);
    } else if (data) {
      setPollResult(
        `${sourceName}: ${data.eventsFound} found, ${data.eventsCreated} new, ${data.eventsSkipped} skipped`
      );
      reexecuteQuery({ requestPolicy: "network-only" });
    }
  }

  return (
    <div className="px-6 py-8 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-curtn-cream">Data Sources</h1>
          <p className="mt-1 text-sm text-curtn-muted">
            Manage RSS and iCal feed subscriptions.
          </p>
        </div>
        <Button variant="primary" onClick={() => setShowCreate(!showCreate)}>
          {showCreate ? "Cancel" : "Add Source"}
        </Button>
      </div>

      {pollResult && (
        <div className="rounded-lg border border-curtn-dark bg-curtn-surface px-4 py-3 text-sm text-curtn-cream">
          {pollResult}
        </div>
      )}

      {/* Create form */}
      {showCreate && (
        <Card className="space-y-4">
          <h2 className="text-sm font-medium text-curtn-cream">
            New Data Source
          </h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="block text-xs text-curtn-muted mb-1">
                Name
              </label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Caveat NYC RSS"
                className="w-full rounded-lg border border-curtn-dark bg-curtn-deep px-3 py-2 text-sm text-curtn-cream focus:border-curtn-coral focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs text-curtn-muted mb-1">
                Type
              </label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as "rss" | "ical")}
                className="w-full rounded-lg border border-curtn-dark bg-curtn-deep px-3 py-2 text-sm text-curtn-cream focus:border-curtn-coral focus:outline-none"
              >
                <option value="rss">RSS Feed</option>
                <option value="ical">iCal Calendar</option>
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs text-curtn-muted mb-1">
                Feed URL, webcal:// link, or Google Calendar ID
              </label>
              <input
                value={url}
                onChange={(e) => {
                  setUrl(e.target.value);
                  setUrlHint(null);
                }}
                onBlur={() => {
                  if (!url.trim()) return;
                  const result = normalizeFeedUrl(url);
                  setUrl(result.url);
                  if (result.detectedType) setType(result.detectedType);
                  setUrlHint(result.hint || null);
                }}
                onPaste={(e) => {
                  // Process on next tick so the pasted value is in the input
                  setTimeout(() => {
                    const val = (e.target as HTMLInputElement).value;
                    if (!val.trim()) return;
                    const result = normalizeFeedUrl(val);
                    setUrl(result.url);
                    if (result.detectedType) setType(result.detectedType);
                    setUrlHint(result.hint || null);
                  }, 0);
                }}
                placeholder="https://example.com/events.rss or webcal://... or calendar-id@group.calendar.google.com"
                className="w-full rounded-lg border border-curtn-dark bg-curtn-deep px-3 py-2 text-sm text-curtn-cream focus:border-curtn-coral focus:outline-none"
              />
              {urlHint && (
                <p className="mt-1 text-xs text-curtn-coral/80">{urlHint}</p>
              )}
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs text-curtn-muted mb-1">
                Cleanup Config (JSON, optional)
              </label>
              <textarea
                value={config}
                onChange={(e) => setConfig(e.target.value)}
                placeholder='{"stripPrefix": "Caveat Presents: ", "defaultVenue": "Caveat", "defaultTypes": ["comedy"]}'
                rows={3}
                className="w-full rounded-lg border border-curtn-dark bg-curtn-deep px-3 py-2 text-sm text-curtn-cream font-mono focus:border-curtn-coral focus:outline-none"
              />
              <p className="mt-1 text-xs text-curtn-muted/60">
                Options: stripPrefix, stripSuffix, defaultVenue, defaultStage,
                defaultCompany, defaultTypes, titleCase
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              variant="primary"
              onClick={handleCreate}
              disabled={creating || !name.trim() || !url.trim()}
            >
              {creating ? "Creating..." : "Create Source"}
            </Button>
          </div>
        </Card>
      )}

      {/* Sources list */}
      {fetching && !data ? (
        <p className="text-sm text-curtn-muted">Loading...</p>
      ) : sources.length === 0 ? (
        <Card>
          <p className="text-sm text-curtn-muted text-center py-8">
            No data sources yet. Add one to start importing events from feeds.
          </p>
        </Card>
      ) : (
        <div className="space-y-3">
          {sources.map((source) => (
            <Card
              key={source.id}
              className="flex items-center justify-between gap-4"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-medium text-curtn-cream truncate">
                    {source.name}
                  </h3>
                  <span className="shrink-0 rounded-full bg-curtn-dark px-2 py-0.5 text-xs text-curtn-muted">
                    {source.type.toUpperCase()}
                  </span>
                  <span
                    className={`shrink-0 h-2 w-2 rounded-full ${source.isActive ? "bg-green-500" : "bg-curtn-muted/30"}`}
                  />
                </div>
                {source.url && (
                  <p className="mt-0.5 text-xs text-curtn-muted/60 truncate">
                    {source.url}
                  </p>
                )}
                {source.lastPolledAt && (
                  <p className="mt-0.5 text-xs text-curtn-muted/40">
                    Last polled: {new Date(source.lastPolledAt).toLocaleString()}
                  </p>
                )}
              </div>
              <Button
                variant="secondary"
                onClick={() => handlePoll(source.id, source.name)}
                disabled={polling || isRecentlyPolled(source.lastPolledAt)}
              >
                {polling ? "Polling..." : isRecentlyPolled(source.lastPolledAt) ? "Cooldown" : "Poll Now"}
              </Button>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
