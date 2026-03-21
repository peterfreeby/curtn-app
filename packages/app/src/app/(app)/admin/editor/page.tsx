"use client";

import { useState, useRef } from "react";
import { useQuery, useMutation } from "urql";
import {
  ADMIN_SHOW_LIST_QUERY,
  ADMIN_VENUE_LIST_QUERY,
  ADMIN_RUN_LIST_QUERY,
  ADMIN_PERFORMANCE_LIST_QUERY,
  ADMIN_PERSON_LIST_QUERY,
  SHOW_UPDATE_MUTATION,
  VENUE_UPDATE_MUTATION,
  RUN_UPDATE_MUTATION,
  PERFORMANCE_UPDATE_MUTATION,
  PERSON_UPDATE_MUTATION,
  SHOW_DELETE_MUTATION,
  VENUE_DELETE_MUTATION,
  RUN_DELETE_MUTATION,
  PERFORMANCE_DELETE_MUTATION,
  PERSON_DELETE_MUTATION,
  SHOW_MERGE_MUTATION,
  VENUE_MERGE_MUTATION,
  RUN_MERGE_MUTATION,
  PERFORMANCE_MERGE_MUTATION,
  PERSON_MERGE_MUTATION,
} from "@/lib/graphql/admin";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";

type EntityTab = "shows" | "venues" | "runs" | "performances" | "people";

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

// --- Image Upload Component ---
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

function ImageUpload({
  entityType,
  entityId,
  currentImageUrl,
  onUploaded,
}: {
  entityType: string;
  entityId: string;
  currentImageUrl: string | null;
  onUploaded: (url: string) => void;
}) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File) {
    setError(null);

    if (!ACCEPTED_TYPES.includes(file.type)) {
      setError("Accepted formats: JPEG, PNG, WebP, GIF");
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      setError("File must be under 5 MB");
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("entityType", entityType);
      formData.append("entityId", entityId);

      const res = await fetch("/api/upload", { method: "POST", body: formData });
      const json = await res.json();

      if (json.error) {
        setError(json.error);
      } else {
        onUploaded(json.url);
      }
    } catch {
      setError("Upload failed");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <div className="flex items-center gap-3">
      {currentImageUrl && (
        <img
          src={currentImageUrl}
          alt=""
          className="h-16 w-16 rounded-lg object-cover border border-curtn-dark shrink-0"
        />
      )}
      <div className="space-y-1">
        <input
          ref={fileRef}
          type="file"
          accept={ACCEPTED_TYPES.join(",")}
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
          }}
        />
        <button
          type="button"
          disabled={uploading}
          onClick={() => fileRef.current?.click()}
          className="rounded-lg border border-curtn-dark bg-curtn-deep px-3 py-1.5 text-xs text-curtn-cream hover:border-curtn-coral transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {uploading ? "Uploading..." : currentImageUrl ? "Replace Image" : "Upload Image"}
        </button>
        {error && <p className="text-xs text-curtn-red">{error}</p>}
      </div>
    </div>
  );
}

// --- Confirm Dialog ---
function ConfirmDialog({
  title,
  message,
  onConfirm,
  onCancel,
}: {
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="w-full max-w-sm rounded-xl border border-curtn-dark bg-curtn-surface p-6 space-y-4">
        <h3 className="text-sm font-semibold text-curtn-cream">{title}</h3>
        <p className="text-xs text-curtn-muted">{message}</p>
        <div className="flex gap-2 justify-end">
          <Button variant="ghost" onClick={onCancel}>Cancel</Button>
          <button
            type="button"
            onClick={onConfirm}
            className="rounded-lg bg-red-600 px-4 py-2 text-xs font-semibold text-white hover:bg-red-700 transition-colors cursor-pointer"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

// --- Merge Picker ---
function MergePicker({
  items,
  excludeId,
  labelFn,
  onSelect,
  onCancel,
}: {
  items: any[];
  excludeId: string;
  labelFn: (item: any) => string;
  onSelect: (targetId: string) => void;
  onCancel: () => void;
}) {
  const [search, setSearch] = useState("");
  const filtered = items
    .filter((item) => item.id !== excludeId)
    .filter((item) => labelFn(item).toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="w-full max-w-md rounded-xl border border-curtn-dark bg-curtn-surface p-6 space-y-4 max-h-[80vh] flex flex-col">
        <h3 className="text-sm font-semibold text-curtn-cream">Merge into...</h3>
        <p className="text-xs text-curtn-muted">Select the target record to merge into. The source will be deleted.</p>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Filter..."
          className="w-full rounded-lg border border-curtn-dark bg-curtn-deep px-3 py-2 text-sm text-curtn-cream focus:border-curtn-coral focus:outline-none"
        />
        <div className="overflow-y-auto flex-1 space-y-1">
          {filtered.length === 0 && (
            <p className="text-xs text-curtn-muted py-2">No matching records.</p>
          )}
          {filtered.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelect(decodeGlobalId(item.id))}
              className="w-full text-left rounded-lg px-3 py-2 text-sm text-curtn-cream hover:bg-curtn-dark/40 transition-colors cursor-pointer"
            >
              {labelFn(item)}
            </button>
          ))}
        </div>
        <div className="flex justify-end">
          <Button variant="ghost" onClick={onCancel}>Cancel</Button>
        </div>
      </div>
    </div>
  );
}

// --- Action Buttons ---
function EntityActions({
  onDelete,
  onMerge,
}: {
  onDelete: () => void;
  onMerge: () => void;
}) {
  return (
    <div className="flex gap-1">
      <button
        type="button"
        onClick={onMerge}
        className="rounded-md px-2 py-1 text-xs text-curtn-muted hover:text-curtn-cream hover:bg-curtn-dark/40 transition-colors cursor-pointer"
      >
        Merge
      </button>
      <button
        type="button"
        onClick={onDelete}
        className="rounded-md px-2 py-1 text-xs text-red-400 hover:text-red-300 hover:bg-red-900/20 transition-colors cursor-pointer"
      >
        Delete
      </button>
    </div>
  );
}

// --- Shows Tab ---
function ShowsEditor() {
  const [search, setSearch] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<any | null>(null);
  const [mergeSource, setMergeSource] = useState<any | null>(null);

  const [{ data, fetching }, reexecute] = useQuery({
    query: ADMIN_SHOW_LIST_QUERY,
    variables: { first: 50, search: search || undefined },
  });
  const [, executeUpdate] = useMutation(SHOW_UPDATE_MUTATION);
  const [, executeDelete] = useMutation(SHOW_DELETE_MUTATION);
  const [, executeMerge] = useMutation(SHOW_MERGE_MUTATION);

  const shows = data?.showList?.edges?.map((e: any) => e.node) || [];

  function startEdit(show: any) {
    setEditingId(show.id);
    setFields({
      title: show.title || "",
      description: show.description || "",
      performanceTypes: (show.performanceTypes || []).join(", "),
      duration: String(show.duration || ""),
      url: show.url || "",
      imageUrl: show.imageUrl || "",
      posterUrl: show.posterUrl || "",
    });
  }

  async function handleSave() {
    if (!editingId) return;
    setMessage(null);
    const result = await executeUpdate({
      input: { showId: decodeGlobalId(editingId), ...fields },
    });
    if (result.data?.showUpdate?.error) {
      setMessage(result.data.showUpdate.error);
    } else {
      setMessage("Show updated");
      setEditingId(null);
      reexecute({ requestPolicy: "network-only" });
    }
  }

  async function handleDelete() {
    if (!confirmDelete) return;
    setMessage(null);
    const result = await executeDelete({
      input: { showId: decodeGlobalId(confirmDelete.id) },
    });
    setConfirmDelete(null);
    if (result.data?.showDelete?.error) {
      setMessage(result.data.showDelete.error);
    } else {
      setMessage("Show deleted");
      reexecute({ requestPolicy: "network-only" });
    }
  }

  async function handleMerge(targetId: string) {
    if (!mergeSource) return;
    setMessage(null);
    const result = await executeMerge({
      input: { sourceId: decodeGlobalId(mergeSource.id), targetId },
    });
    setMergeSource(null);
    if (result.data?.showMerge?.error) {
      setMessage(result.data.showMerge.error);
    } else {
      setMessage(`Merged into "${result.data?.showMerge?.show?.title}"`);
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
      {message && <p className="text-xs text-curtn-coral">{message}</p>}
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
                  <ImageUpload
                    entityType="show"
                    entityId={decodeGlobalId(show.id)}
                    currentImageUrl={fields.imageUrl || null}
                    onUploaded={(url) => setFields((f) => ({ ...f, imageUrl: url }))}
                  />
                  <ImageUpload
                    entityType="show-poster"
                    entityId={decodeGlobalId(show.id)}
                    currentImageUrl={fields.posterUrl || null}
                    onUploaded={(url) => setFields((f) => ({ ...f, posterUrl: url }))}
                  />
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
                  <div className="flex items-center gap-2 shrink-0">
                    <Button variant="ghost" onClick={() => startEdit(show)}>Edit</Button>
                    <EntityActions
                      onDelete={() => setConfirmDelete(show)}
                      onMerge={() => setMergeSource(show)}
                    />
                  </div>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
      {confirmDelete && (
        <ConfirmDialog
          title={`Delete "${confirmDelete.title}"?`}
          message="This will permanently delete this show and all its runs, performances, credits, and reviews."
          onConfirm={handleDelete}
          onCancel={() => setConfirmDelete(null)}
        />
      )}
      {mergeSource && (
        <MergePicker
          items={shows}
          excludeId={mergeSource.id}
          labelFn={(s) => s.title}
          onSelect={handleMerge}
          onCancel={() => setMergeSource(null)}
        />
      )}
    </div>
  );
}

// --- Venues Tab ---
function VenuesEditor() {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<any | null>(null);
  const [mergeSource, setMergeSource] = useState<any | null>(null);

  const [{ data, fetching }, reexecute] = useQuery({
    query: ADMIN_VENUE_LIST_QUERY,
    variables: { first: 50 },
  });
  const [, executeUpdate] = useMutation(VENUE_UPDATE_MUTATION);
  const [, executeDelete] = useMutation(VENUE_DELETE_MUTATION);
  const [, executeMerge] = useMutation(VENUE_MERGE_MUTATION);

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
      imageUrl: venue.imageUrl || "",
      permanentlyClosed: venue.permanentlyClosed ? "true" : "false",
      closedDate: venue.closedDate ? venue.closedDate.split("T")[0] : "",
    });
  }

  async function handleSave() {
    if (!editingId) return;
    setMessage(null);
    const { permanentlyClosed, closedDate, ...rest } = fields;
    const result = await executeUpdate({
      input: {
        venueId: decodeGlobalId(editingId),
        ...rest,
        permanentlyClosed: permanentlyClosed === "true",
        closedDate: closedDate || null,
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

  async function handleDelete() {
    if (!confirmDelete) return;
    setMessage(null);
    const result = await executeDelete({
      input: { venueId: decodeGlobalId(confirmDelete.id) },
    });
    setConfirmDelete(null);
    if (result.data?.venueDelete?.error) {
      setMessage(result.data.venueDelete.error);
    } else {
      setMessage("Venue deleted");
      reexecute({ requestPolicy: "network-only" });
    }
  }

  async function handleMerge(targetId: string) {
    if (!mergeSource) return;
    setMessage(null);
    const result = await executeMerge({
      input: { sourceId: decodeGlobalId(mergeSource.id), targetId },
    });
    setMergeSource(null);
    if (result.data?.venueMerge?.error) {
      setMessage(result.data.venueMerge.error);
    } else {
      setMessage("Venue merged");
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
                    <FieldEditor
                      label="Permanently Closed"
                      value={fields.permanentlyClosed}
                      onChange={(v) => setFields((f) => ({ ...f, permanentlyClosed: v }))}
                      type="select"
                      options={[
                        { value: "false", label: "No" },
                        { value: "true", label: "Yes" },
                      ]}
                    />
                    {fields.permanentlyClosed === "true" && (
                      <FieldEditor label="Closed Date" value={fields.closedDate} onChange={(v) => setFields((f) => ({ ...f, closedDate: v }))} type="date" />
                    )}
                    <div className="sm:col-span-2">
                      <FieldEditor label="Description" value={fields.description} onChange={(v) => setFields((f) => ({ ...f, description: v }))} type="textarea" />
                    </div>
                  </div>
                  <ImageUpload
                    entityType="venue"
                    entityId={decodeGlobalId(venue.id)}
                    currentImageUrl={fields.imageUrl || null}
                    onUploaded={(url) => setFields((f) => ({ ...f, imageUrl: url }))}
                  />
                  <div className="flex gap-2">
                    <Button variant="primary" onClick={handleSave}>Save</Button>
                    <Button variant="ghost" onClick={() => setEditingId(null)}>Cancel</Button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="text-sm font-medium text-curtn-cream truncate">
                      {venue.name}
                      {venue.permanentlyClosed && (
                        <span className="ml-2 text-[10px] uppercase tracking-wider text-curtn-muted/70">Closed</span>
                      )}
                    </h3>
                    <p className="text-xs text-curtn-muted mt-0.5">
                      {venue.address}{venue.city ? `, ${venue.city}` : ""}
                      {venue.capacity ? ` · ${venue.capacity} cap` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Button variant="ghost" onClick={() => startEdit(venue)}>Edit</Button>
                    <EntityActions
                      onDelete={() => setConfirmDelete(venue)}
                      onMerge={() => setMergeSource(venue)}
                    />
                  </div>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
      {confirmDelete && (
        <ConfirmDialog
          title={`Delete "${confirmDelete.name}"?`}
          message="This will only work if no runs or performances reference this venue. Use Merge instead to reassign references."
          onConfirm={handleDelete}
          onCancel={() => setConfirmDelete(null)}
        />
      )}
      {mergeSource && (
        <MergePicker
          items={venues}
          excludeId={mergeSource.id}
          labelFn={(v) => `${v.name}${v.city ? ` (${v.city})` : ""}`}
          onSelect={handleMerge}
          onCancel={() => setMergeSource(null)}
        />
      )}
    </div>
  );
}

// --- Runs Tab ---
function RunsEditor() {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<any | null>(null);
  const [mergeSource, setMergeSource] = useState<any | null>(null);

  const [{ data, fetching }, reexecute] = useQuery({
    query: ADMIN_RUN_LIST_QUERY,
    variables: { first: 50 },
  });
  const [, executeUpdate] = useMutation(RUN_UPDATE_MUTATION);
  const [, executeDelete] = useMutation(RUN_DELETE_MUTATION);
  const [, executeMerge] = useMutation(RUN_MERGE_MUTATION);

  const runs = data?.runList?.edges?.map((e: any) => e.node) || [];

  function startEdit(run: any) {
    setEditingId(run.id);
    setFields({
      title: run.title || "",
      description: run.description || "",
      intermissions: String(run.intermissions || "0"),
      startDate: run.startDate ? run.startDate.split("T")[0] : "",
      endDate: run.endDate ? run.endDate.split("T")[0] : "",
      imageUrl: run.imageUrl || "",
      posterUrl: run.posterUrl || "",
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

  async function handleDelete() {
    if (!confirmDelete) return;
    setMessage(null);
    const result = await executeDelete({
      input: { runId: decodeGlobalId(confirmDelete.id) },
    });
    setConfirmDelete(null);
    if (result.data?.runDelete?.error) {
      setMessage(result.data.runDelete.error);
    } else {
      setMessage("Run deleted");
      reexecute({ requestPolicy: "network-only" });
    }
  }

  async function handleMerge(targetId: string) {
    if (!mergeSource) return;
    setMessage(null);
    const result = await executeMerge({
      input: { sourceId: decodeGlobalId(mergeSource.id), targetId },
    });
    setMergeSource(null);
    if (result.data?.runMerge?.error) {
      setMessage(result.data.runMerge.error);
    } else {
      setMessage("Run merged");
      reexecute({ requestPolicy: "network-only" });
    }
  }

  function runLabel(run: any): string {
    const title = run.effectiveTitle || run.show?.title || "Untitled";
    const company = run.productionCompany?.name;
    return company ? `${title} (${company})` : title;
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
                  <ImageUpload
                    entityType="run"
                    entityId={decodeGlobalId(run.id)}
                    currentImageUrl={fields.imageUrl || null}
                    onUploaded={(url) => setFields((f) => ({ ...f, imageUrl: url }))}
                  />
                  <ImageUpload
                    entityType="run-poster"
                    entityId={decodeGlobalId(run.id)}
                    currentImageUrl={fields.posterUrl || null}
                    onUploaded={(url) => setFields((f) => ({ ...f, posterUrl: url }))}
                  />
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
                  <div className="flex items-center gap-2 shrink-0">
                    <Button variant="ghost" onClick={() => startEdit(run)}>Edit</Button>
                    <EntityActions
                      onDelete={() => setConfirmDelete(run)}
                      onMerge={() => setMergeSource(run)}
                    />
                  </div>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
      {confirmDelete && (
        <ConfirmDialog
          title={`Delete "${confirmDelete.effectiveTitle}"?`}
          message="This will permanently delete this run and all its performances, credits, and reviews."
          onConfirm={handleDelete}
          onCancel={() => setConfirmDelete(null)}
        />
      )}
      {mergeSource && (
        <MergePicker
          items={runs}
          excludeId={mergeSource.id}
          labelFn={runLabel}
          onSelect={handleMerge}
          onCancel={() => setMergeSource(null)}
        />
      )}
    </div>
  );
}

// --- Performances Tab ---
function PerformancesEditor() {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<any | null>(null);
  const [mergeSource, setMergeSource] = useState<any | null>(null);

  const [{ data, fetching }, reexecute] = useQuery({
    query: ADMIN_PERFORMANCE_LIST_QUERY,
    variables: { first: 50 },
  });
  const [, executeUpdate] = useMutation(PERFORMANCE_UPDATE_MUTATION);
  const [, executeDelete] = useMutation(PERFORMANCE_DELETE_MUTATION);
  const [, executeMerge] = useMutation(PERFORMANCE_MERGE_MUTATION);

  const performances = data?.performanceList?.edges?.map((e: any) => e.node) || [];

  function startEdit(perf: any) {
    setEditingId(perf.id);
    setFields({
      date: perf.date ? perf.date.split("T")[0] : "",
      time: perf.time || "",
      ticketUrl: perf.ticketUrl || "",
      soldOut: perf.soldOut ? "true" : "false",
      description: perf.effectiveDescription || "",
      imageUrl: perf.imageUrl || "",
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

  async function handleDelete() {
    if (!confirmDelete) return;
    setMessage(null);
    const result = await executeDelete({
      input: { performanceId: decodeGlobalId(confirmDelete.id) },
    });
    setConfirmDelete(null);
    if (result.data?.performanceDelete?.error) {
      setMessage(result.data.performanceDelete.error);
    } else {
      setMessage("Performance deleted");
      reexecute({ requestPolicy: "network-only" });
    }
  }

  async function handleMerge(targetId: string) {
    if (!mergeSource) return;
    setMessage(null);
    const result = await executeMerge({
      input: { sourceId: decodeGlobalId(mergeSource.id), targetId },
    });
    setMergeSource(null);
    if (result.data?.performanceMerge?.error) {
      setMessage(result.data.performanceMerge.error);
    } else {
      setMessage("Performance merged");
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

  function perfLabel(perf: any): string {
    const title = perf.run?.effectiveTitle || perf.run?.show?.title || "Untitled";
    const date = formatDate(perf.date);
    return `${title} — ${date}${perf.time ? ` at ${perf.time}` : ""}`;
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
                  <ImageUpload
                    entityType="performance"
                    entityId={decodeGlobalId(perf.id)}
                    currentImageUrl={fields.imageUrl || null}
                    onUploaded={(url) => setFields((f) => ({ ...f, imageUrl: url }))}
                  />
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
                  <div className="flex items-center gap-2 shrink-0">
                    <Button variant="ghost" onClick={() => startEdit(perf)}>Edit</Button>
                    <EntityActions
                      onDelete={() => setConfirmDelete(perf)}
                      onMerge={() => setMergeSource(perf)}
                    />
                  </div>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
      {confirmDelete && (
        <ConfirmDialog
          title="Delete this performance?"
          message={`${confirmDelete.run?.effectiveTitle || "Untitled"} — ${formatDate(confirmDelete.date)}. This will also delete any reviews for this performance.`}
          onConfirm={handleDelete}
          onCancel={() => setConfirmDelete(null)}
        />
      )}
      {mergeSource && (
        <MergePicker
          items={performances}
          excludeId={mergeSource.id}
          labelFn={perfLabel}
          onSelect={handleMerge}
          onCancel={() => setMergeSource(null)}
        />
      )}
    </div>
  );
}

// --- People Tab ---
function PeopleEditor() {
  const [search, setSearch] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<any | null>(null);
  const [mergeSource, setMergeSource] = useState<any | null>(null);

  const [{ data, fetching }, reexecute] = useQuery({
    query: ADMIN_PERSON_LIST_QUERY,
    variables: { first: 50, search: search || undefined },
  });
  const [, executeUpdate] = useMutation(PERSON_UPDATE_MUTATION);
  const [, executeDelete] = useMutation(PERSON_DELETE_MUTATION);
  const [, executeMerge] = useMutation(PERSON_MERGE_MUTATION);

  const people = data?.personList?.edges?.map((e: any) => e.node) || [];

  function startEdit(person: any) {
    setEditingId(person.id);
    setFields({
      name: person.name || "",
      bio: person.bio || "",
      headshotUrl: person.headshotUrl || "",
      wikidataId: person.wikidataId || "",
    });
  }

  async function handleSave() {
    if (!editingId) return;
    setMessage(null);
    const result = await executeUpdate({
      input: { personId: decodeGlobalId(editingId), ...fields },
    });
    if (result.data?.personUpdate?.error) {
      setMessage(result.data.personUpdate.error);
    } else {
      setMessage("Person updated");
      setEditingId(null);
      reexecute({ requestPolicy: "network-only" });
    }
  }

  async function handleDelete() {
    if (!confirmDelete) return;
    setMessage(null);
    const result = await executeDelete({
      input: { personId: decodeGlobalId(confirmDelete.id) },
    });
    setConfirmDelete(null);
    if (result.data?.personDelete?.error) {
      setMessage(result.data.personDelete.error);
    } else {
      setMessage("Person deleted");
      reexecute({ requestPolicy: "network-only" });
    }
  }

  async function handleMerge(targetId: string) {
    if (!mergeSource) return;
    setMessage(null);
    const result = await executeMerge({
      input: { sourceId: decodeGlobalId(mergeSource.id), targetId },
    });
    setMergeSource(null);
    if (result.data?.personMerge?.error) {
      setMessage(result.data.personMerge.error);
    } else {
      setMessage(`Merged into "${result.data?.personMerge?.person?.name}"`);
      reexecute({ requestPolicy: "network-only" });
    }
  }

  return (
    <div className="space-y-4">
      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search people..."
        className="w-full rounded-lg border border-curtn-dark bg-curtn-deep px-3 py-2 text-sm text-curtn-cream focus:border-curtn-coral focus:outline-none"
      />
      {message && <p className="text-xs text-curtn-coral">{message}</p>}
      {fetching && !data ? (
        <p className="text-sm text-curtn-muted">Loading...</p>
      ) : (
        <div className="space-y-2">
          {people.map((person: any) => (
            <Card key={person.id} className="space-y-3">
              {editingId === person.id ? (
                <div className="space-y-3">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <FieldEditor label="Name" value={fields.name} onChange={(v) => setFields((f) => ({ ...f, name: v }))} />
                    <FieldEditor label="Wikidata ID" value={fields.wikidataId} onChange={(v) => setFields((f) => ({ ...f, wikidataId: v }))} />
                    <div className="sm:col-span-2">
                      <FieldEditor label="Bio" value={fields.bio} onChange={(v) => setFields((f) => ({ ...f, bio: v }))} type="textarea" />
                    </div>
                  </div>
                  <ImageUpload
                    entityType="person"
                    entityId={decodeGlobalId(person.id)}
                    currentImageUrl={fields.headshotUrl || null}
                    onUploaded={(url) => setFields((f) => ({ ...f, headshotUrl: url }))}
                  />
                  <div className="flex gap-2">
                    <Button variant="primary" onClick={handleSave}>Save</Button>
                    <Button variant="ghost" onClick={() => setEditingId(null)}>Cancel</Button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    {person.headshotUrl && (
                      <img
                        src={person.headshotUrl}
                        alt=""
                        className="h-8 w-8 rounded-full object-cover border border-curtn-dark shrink-0"
                      />
                    )}
                    <div className="min-w-0">
                      <h3 className="text-sm font-medium text-curtn-cream truncate">{person.name}</h3>
                      {person.bio && (
                        <p className="text-xs text-curtn-muted mt-0.5 truncate">{person.bio}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Button variant="ghost" onClick={() => startEdit(person)}>Edit</Button>
                    <EntityActions
                      onDelete={() => setConfirmDelete(person)}
                      onMerge={() => setMergeSource(person)}
                    />
                  </div>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
      {confirmDelete && (
        <ConfirmDialog
          title={`Delete "${confirmDelete.name}"?`}
          message="This will permanently delete this person and all their credits."
          onConfirm={handleDelete}
          onCancel={() => setConfirmDelete(null)}
        />
      )}
      {mergeSource && (
        <MergePicker
          items={people}
          excludeId={mergeSource.id}
          labelFn={(p) => p.name}
          onSelect={handleMerge}
          onCancel={() => setMergeSource(null)}
        />
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
          Browse, edit, delete, and merge shows, venues, runs, performances, and people.
        </p>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 rounded-lg bg-curtn-surface p-1">
        {(["shows", "venues", "runs", "performances", "people"] as EntityTab[]).map(
          (t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer ${
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
      {tab === "people" && <PeopleEditor />}
    </div>
  );
}
