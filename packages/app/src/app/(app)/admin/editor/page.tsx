"use client";

import { useState } from "react";
import { useQuery, useMutation } from "urql";
import {
  ADMIN_SHOW_LIST_QUERY,
  ADMIN_VENUE_LIST_QUERY,
  ADMIN_RUN_LIST_QUERY,
  ADMIN_PERFORMANCE_LIST_QUERY,
  SHOW_UPDATE_MUTATION,
  VENUE_UPDATE_MUTATION,
  RUN_UPDATE_MUTATION,
  PERFORMANCE_UPDATE_MUTATION,
} from "@/lib/graphql/admin";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";

type EntityTab = "shows" | "venues" | "runs" | "performances";

function decodeGlobalId(globalId: string): string {
  return atob(globalId).split(":")[1];
}

// --- Field Editor Component ---
function FieldEditor({
  label,
  value,
  onChange,
  type = "text",
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: "text" | "textarea" | "select" | "date" | "number";
  options?: { value: string; label: string }[];
}) {
  const inputClass =
    "w-full rounded-lg border border-curtn-dark bg-curtn-deep px-3 py-2 text-sm text-curtn-cream focus:border-curtn-coral focus:outline-none";

  return (
    <div>
      <label className="block text-xs text-curtn-muted mb-1">{label}</label>
      {type === "textarea" ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={3}
          className={inputClass}
        />
      ) : type === "select" && options ? (
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={inputClass}
        >
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      ) : (
        <input
          type={type === "number" ? "number" : type === "date" ? "date" : "text"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={inputClass}
        />
      )}
    </div>
  );
}

// --- Shows Tab ---
function ShowsEditor() {
  const [search, setSearch] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | null>(null);

  const [{ data, fetching }, reexecute] = useQuery({
    query: ADMIN_SHOW_LIST_QUERY,
    variables: { first: 50, search: search || undefined },
  });
  const [, executeUpdate] = useMutation(SHOW_UPDATE_MUTATION);

  const shows = data?.showList?.edges?.map((e: any) => e.node) || [];

  function startEdit(show: any) {
    setEditingId(show.id);
    setFields({
      title: show.title || "",
      description: show.description || "",
      performanceTypes: (show.performanceTypes || []).join(", "),
      duration: String(show.duration || ""),
      url: show.url || "",
    });
  }

  async function handleSave() {
    if (!editingId) return;
    setMessage(null);
    const result = await executeUpdate({
      input: {
        showId: decodeGlobalId(editingId),
        ...fields,
      },
    });
    if (result.data?.showUpdate?.error) {
      setMessage(result.data.showUpdate.error);
    } else {
      setMessage("Show updated");
      setEditingId(null);
      reexecute({ requestPolicy: "network-only" });
    }
  }

  return (
    <div className="space-y-4">
      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search shows..."
        className="w-full rounded-lg border border-curtn-dark bg-curtn-deep px-3 py-2 text-sm text-curtn-cream focus:border-curtn-coral focus:outline-none"
      />
      {message && (
        <p className="text-xs text-curtn-coral">{message}</p>
      )}
      {fetching && !data ? (
        <p className="text-sm text-curtn-muted">Loading...</p>
      ) : (
        <div className="space-y-2">
          {shows.map((show: any) => (
            <Card key={show.id} className="space-y-3">
              {editingId === show.id ? (
                <div className="space-y-3">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <FieldEditor label="Title" value={fields.title} onChange={(v) => setFields((f) => ({ ...f, title: v }))} />
                    <FieldEditor label="Performance Types" value={fields.performanceTypes} onChange={(v) => setFields((f) => ({ ...f, performanceTypes: v }))} />
                    <FieldEditor label="Duration (minutes)" value={fields.duration} onChange={(v) => setFields((f) => ({ ...f, duration: v }))} type="number" />
                    <FieldEditor label="URL" value={fields.url} onChange={(v) => setFields((f) => ({ ...f, url: v }))} />
                    <div className="sm:col-span-2">
                      <FieldEditor label="Description" value={fields.description} onChange={(v) => setFields((f) => ({ ...f, description: v }))} type="textarea" />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="primary" onClick={handleSave}>Save</Button>
                    <Button variant="ghost" onClick={() => setEditingId(null)}>Cancel</Button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="text-sm font-medium text-curtn-cream truncate">{show.title}</h3>
                    <div className="flex gap-2 mt-0.5 text-xs text-curtn-muted">
                      {show.performanceTypes?.map((t: string) => (
                        <span key={t} className="rounded-full bg-curtn-dark px-2 py-0.5">{t}</span>
                      ))}
                      {show.duration > 0 && <span>{show.duration} min</span>}
                    </div>
                  </div>
                  <Button variant="ghost" onClick={() => startEdit(show)}>Edit</Button>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// --- Venues Tab ---
function VenuesEditor() {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | null>(null);

  const [{ data, fetching }, reexecute] = useQuery({
    query: ADMIN_VENUE_LIST_QUERY,
    variables: { first: 50 },
  });
  const [, executeUpdate] = useMutation(VENUE_UPDATE_MUTATION);

  const venues = data?.venueList?.edges?.map((e: any) => e.node) || [];

  function startEdit(venue: any) {
    setEditingId(venue.id);
    setFields({
      name: venue.name || "",
      description: venue.description || "",
      address: venue.address || "",
      city: venue.city || "",
      state: venue.state || "",
      zipCode: venue.zipCode || "",
      capacity: String(venue.capacity || ""),
      venueType: venue.venueType || "theater",
      website: venue.website || "",
      phone: venue.phone || "",
      email: venue.email || "",
    });
  }

  async function handleSave() {
    if (!editingId) return;
    setMessage(null);
    const result = await executeUpdate({
      input: {
        venueId: decodeGlobalId(editingId),
        ...fields,
      },
    });
    if (result.data?.venueUpdate?.error) {
      setMessage(result.data.venueUpdate.error);
    } else {
      setMessage("Venue updated");
      setEditingId(null);
      reexecute({ requestPolicy: "network-only" });
    }
  }

  const venueTypeOptions = [
    { value: "theater", label: "Theater" },
    { value: "concert-hall", label: "Concert Hall" },
    { value: "dance-studio", label: "Dance Studio" },
    { value: "comedy-club", label: "Comedy Club" },
    { value: "multi-purpose", label: "Multi-Purpose" },
    { value: "outdoor", label: "Outdoor" },
    { value: "other", label: "Other" },
  ];

  return (
    <div className="space-y-4">
      {message && <p className="text-xs text-curtn-coral">{message}</p>}
      {fetching && !data ? (
        <p className="text-sm text-curtn-muted">Loading...</p>
      ) : (
        <div className="space-y-2">
          {venues.map((venue: any) => (
            <Card key={venue.id} className="space-y-3">
              {editingId === venue.id ? (
                <div className="space-y-3">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <FieldEditor label="Name" value={fields.name} onChange={(v) => setFields((f) => ({ ...f, name: v }))} />
                    <FieldEditor label="Venue Type" value={fields.venueType} onChange={(v) => setFields((f) => ({ ...f, venueType: v }))} type="select" options={venueTypeOptions} />
                    <FieldEditor label="Address" value={fields.address} onChange={(v) => setFields((f) => ({ ...f, address: v }))} />
                    <FieldEditor label="City" value={fields.city} onChange={(v) => setFields((f) => ({ ...f, city: v }))} />
                    <FieldEditor label="State" value={fields.state} onChange={(v) => setFields((f) => ({ ...f, state: v }))} />
                    <FieldEditor label="ZIP Code" value={fields.zipCode} onChange={(v) => setFields((f) => ({ ...f, zipCode: v }))} />
                    <FieldEditor label="Capacity" value={fields.capacity} onChange={(v) => setFields((f) => ({ ...f, capacity: v }))} type="number" />
                    <FieldEditor label="Website" value={fields.website} onChange={(v) => setFields((f) => ({ ...f, website: v }))} />
                    <FieldEditor label="Phone" value={fields.phone} onChange={(v) => setFields((f) => ({ ...f, phone: v }))} />
                    <FieldEditor label="Email" value={fields.email} onChange={(v) => setFields((f) => ({ ...f, email: v }))} />
                    <div className="sm:col-span-2">
                      <FieldEditor label="Description" value={fields.description} onChange={(v) => setFields((f) => ({ ...f, description: v }))} type="textarea" />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="primary" onClick={handleSave}>Save</Button>
                    <Button variant="ghost" onClick={() => setEditingId(null)}>Cancel</Button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="text-sm font-medium text-curtn-cream truncate">{venue.name}</h3>
                    <p className="text-xs text-curtn-muted mt-0.5">
                      {venue.address}{venue.city ? `, ${venue.city}` : ""}
                      {venue.capacity ? ` · ${venue.capacity} cap` : ""}
                    </p>
                  </div>
                  <Button variant="ghost" onClick={() => startEdit(venue)}>Edit</Button>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// --- Runs Tab ---
function RunsEditor() {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | null>(null);

  const [{ data, fetching }, reexecute] = useQuery({
    query: ADMIN_RUN_LIST_QUERY,
    variables: { first: 50 },
  });
  const [, executeUpdate] = useMutation(RUN_UPDATE_MUTATION);

  const runs = data?.runList?.edges?.map((e: any) => e.node) || [];

  function startEdit(run: any) {
    setEditingId(run.id);
    setFields({
      title: run.title || "",
      description: run.description || "",
      intermissions: String(run.intermissions || "0"),
      startDate: run.startDate ? run.startDate.split("T")[0] : "",
      endDate: run.endDate ? run.endDate.split("T")[0] : "",
    });
  }

  async function handleSave() {
    if (!editingId) return;
    setMessage(null);
    const result = await executeUpdate({
      input: {
        runId: decodeGlobalId(editingId),
        ...fields,
        startDate: fields.startDate ? new Date(fields.startDate).toISOString() : undefined,
        endDate: fields.endDate ? new Date(fields.endDate).toISOString() : undefined,
      },
    });
    if (result.data?.runUpdate?.error) {
      setMessage(result.data.runUpdate.error);
    } else {
      setMessage("Run updated");
      setEditingId(null);
      reexecute({ requestPolicy: "network-only" });
    }
  }

  return (
    <div className="space-y-4">
      {message && <p className="text-xs text-curtn-coral">{message}</p>}
      {fetching && !data ? (
        <p className="text-sm text-curtn-muted">Loading...</p>
      ) : (
        <div className="space-y-2">
          {runs.map((run: any) => (
            <Card key={run.id} className="space-y-3">
              {editingId === run.id ? (
                <div className="space-y-3">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <FieldEditor label="Run Title" value={fields.title} onChange={(v) => setFields((f) => ({ ...f, title: v }))} />
                    <FieldEditor label="Intermissions" value={fields.intermissions} onChange={(v) => setFields((f) => ({ ...f, intermissions: v }))} type="number" />
                    <FieldEditor label="Start Date" value={fields.startDate} onChange={(v) => setFields((f) => ({ ...f, startDate: v }))} type="date" />
                    <FieldEditor label="End Date" value={fields.endDate} onChange={(v) => setFields((f) => ({ ...f, endDate: v }))} type="date" />
                    <div className="sm:col-span-2">
                      <FieldEditor label="Description" value={fields.description} onChange={(v) => setFields((f) => ({ ...f, description: v }))} type="textarea" />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="primary" onClick={handleSave}>Save</Button>
                    <Button variant="ghost" onClick={() => setEditingId(null)}>Cancel</Button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="text-sm font-medium text-curtn-cream truncate">{run.effectiveTitle}</h3>
                    <p className="text-xs text-curtn-muted mt-0.5">
                      {run.show?.title !== run.effectiveTitle && (
                        <span className="text-curtn-muted/60">{run.show?.title} · </span>
                      )}
                      {run.productionCompany?.name || "No company"}
                      {run.venues?.length > 0 && ` · ${run.venues.map((v: any) => v.name).join(", ")}`}
                    </p>
                  </div>
                  <Button variant="ghost" onClick={() => startEdit(run)}>Edit</Button>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// --- Performances Tab ---
function PerformancesEditor() {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | null>(null);

  const [{ data, fetching }, reexecute] = useQuery({
    query: ADMIN_PERFORMANCE_LIST_QUERY,
    variables: { first: 50 },
  });
  const [, executeUpdate] = useMutation(PERFORMANCE_UPDATE_MUTATION);

  const performances = data?.performanceList?.edges?.map((e: any) => e.node) || [];

  function startEdit(perf: any) {
    setEditingId(perf.id);
    setFields({
      date: perf.date ? perf.date.split("T")[0] : "",
      time: perf.time || "",
      ticketUrl: perf.ticketUrl || "",
      soldOut: perf.soldOut ? "true" : "false",
      description: perf.effectiveDescription || "",
    });
  }

  async function handleSave() {
    if (!editingId) return;
    setMessage(null);
    const result = await executeUpdate({
      input: {
        performanceId: decodeGlobalId(editingId),
        date: fields.date ? new Date(fields.date).toISOString() : undefined,
        time: fields.time,
        ticketUrl: fields.ticketUrl,
        soldOut: fields.soldOut === "true",
        description: fields.description,
      },
    });
    if (result.data?.performanceUpdate?.error) {
      setMessage(result.data.performanceUpdate.error);
    } else {
      setMessage("Performance updated");
      setEditingId(null);
      reexecute({ requestPolicy: "network-only" });
    }
  }

  function formatDate(iso: string | null): string {
    if (!iso) return "\u2014";
    return new Date(iso).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }

  return (
    <div className="space-y-4">
      {message && <p className="text-xs text-curtn-coral">{message}</p>}
      {fetching && !data ? (
        <p className="text-sm text-curtn-muted">Loading...</p>
      ) : (
        <div className="space-y-2">
          {performances.map((perf: any) => (
            <Card key={perf.id} className="space-y-3">
              {editingId === perf.id ? (
                <div className="space-y-3">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <FieldEditor label="Date" value={fields.date} onChange={(v) => setFields((f) => ({ ...f, date: v }))} type="date" />
                    <FieldEditor label="Time" value={fields.time} onChange={(v) => setFields((f) => ({ ...f, time: v }))} />
                    <FieldEditor label="Ticket URL" value={fields.ticketUrl} onChange={(v) => setFields((f) => ({ ...f, ticketUrl: v }))} />
                    <FieldEditor
                      label="Sold Out"
                      value={fields.soldOut}
                      onChange={(v) => setFields((f) => ({ ...f, soldOut: v }))}
                      type="select"
                      options={[
                        { value: "false", label: "No" },
                        { value: "true", label: "Yes" },
                      ]}
                    />
                    <div className="sm:col-span-2">
                      <FieldEditor label="Description (override)" value={fields.description} onChange={(v) => setFields((f) => ({ ...f, description: v }))} type="textarea" />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="primary" onClick={handleSave}>Save</Button>
                    <Button variant="ghost" onClick={() => setEditingId(null)}>Cancel</Button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="text-sm font-medium text-curtn-cream truncate">
                      {perf.run?.effectiveTitle || perf.run?.show?.title || "Untitled"}
                    </h3>
                    <p className="text-xs text-curtn-muted mt-0.5">
                      {formatDate(perf.date)}{perf.time ? ` at ${perf.time}` : ""}
                      {perf.venue?.name ? ` · ${perf.venue.name}` : ""}
                      {perf.soldOut && <span className="text-curtn-red ml-2">Sold Out</span>}
                    </p>
                  </div>
                  <Button variant="ghost" onClick={() => startEdit(perf)}>Edit</Button>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// --- Main Editor Page ---
export default function AdminEditorPage() {
  const [tab, setTab] = useState<EntityTab>("shows");

  return (
    <div className="px-6 py-8 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-bold text-curtn-cream">Data Editor</h1>
        <p className="mt-1 text-sm text-curtn-muted">
          Browse and edit shows, venues, runs, and performances.
        </p>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 rounded-lg bg-curtn-surface p-1">
        {(["shows", "venues", "runs", "performances"] as EntityTab[]).map(
          (t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                tab === t
                  ? "bg-curtn-deep text-curtn-cream"
                  : "text-curtn-muted hover:text-curtn-cream"
              }`}
            >
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          )
        )}
      </div>

      {tab === "shows" && <ShowsEditor />}
      {tab === "venues" && <VenuesEditor />}
      {tab === "runs" && <RunsEditor />}
      {tab === "performances" && <PerformancesEditor />}
    </div>
  );
}
