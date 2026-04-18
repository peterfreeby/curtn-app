"use client";

import { useState, useRef, useEffect, useCallback } from "react";
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
  PICKER_SHOWS_QUERY,
  PICKER_VENUES_QUERY,
  PICKER_COMPANIES_QUERY,
  PICKER_RUNS_QUERY,
  PICKER_PEOPLE_QUERY,
  CREDIT_ADD_MUTATION,
  CREDIT_REMOVE_MUTATION,
  SHOW_FIND_OR_CREATE_MUTATION,
  VENUE_FIND_OR_CREATE_MUTATION,
  PRODUCTION_COMPANY_CREATE_MUTATION,
  RUN_FIND_OR_CREATE_MUTATION,
  PERFORMANCE_CREATE_MUTATION,
  PERSON_CREATE_MUTATION,
} from "@/lib/graphql/admin";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { RelationPicker, type RelationOption } from "@/components/admin/RelationPicker";
import { EntityDataSourcesPanel } from "@/components/admin/EntityDataSourcesPanel";

const PAGE_SIZE = 50;

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
          <Button variant="tertiary" onClick={onCancel}>Cancel</Button>
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
          <Button variant="tertiary" onClick={onCancel}>Cancel</Button>
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

// --- Runs Section (inline within Show editing) ---
function RunsSection({
  showId,
  runs,
  onChanged,
}: {
  showId: string;
  runs: any[];
  onChanged: () => void;
}) {
  const [adding, setAdding] = useState(false);
  const [newCompanyId, setNewCompanyId] = useState<string | null>(null);
  const [newVenueIds, setNewVenueIds] = useState<string[]>([]);
  const [newStartDate, setNewStartDate] = useState("");
  const [newEndDate, setNewEndDate] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  const [{ data: companiesData }, reexecuteCompanies] = useQuery({
    query: PICKER_COMPANIES_QUERY,
    variables: { first: 100 },
    pause: !adding,
  });
  const [{ data: venuesData }, reexecuteVenues] = useQuery({
    query: PICKER_VENUES_QUERY,
    variables: { first: 100 },
    pause: !adding,
  });
  const [, executeRunCreate] = useMutation(RUN_FIND_OR_CREATE_MUTATION);
  const [, executeCompanyCreate] = useMutation(PRODUCTION_COMPANY_CREATE_MUTATION);
  const [, executeVenueCreate] = useMutation(VENUE_FIND_OR_CREATE_MUTATION);

  const companyOptions: RelationOption[] =
    companiesData?.productionCompanyList?.edges?.map((e: any) => ({
      id: e.node.id,
      label: e.node.name,
    })) || [];
  const venueOptions: RelationOption[] =
    venuesData?.venueList?.edges?.map((e: any) => ({
      id: e.node.id,
      label: e.node.name,
      sublabel: e.node.city,
    })) || [];

  async function handleCreateCompany(name: string) {
    const result = await executeCompanyCreate({ input: { name } });
    if (result.data?.productionCompanyCreate?.productionCompany?.id) {
      setNewCompanyId(result.data.productionCompanyCreate.productionCompany.id);
      reexecuteCompanies({ requestPolicy: "network-only" });
    }
  }

  async function handleCreateVenue(name: string) {
    const result = await executeVenueCreate({
      input: { name, address: "TBD", city: "NYC", state: "NY", latitude: 40.7128, longitude: -74.006 },
    });
    if (result.data?.venueFindOrCreate?.venue?.id) {
      setNewVenueIds((prev) => [...prev, result.data.venueFindOrCreate.venue.id]);
      reexecuteVenues({ requestPolicy: "network-only" });
    }
  }

  async function handleAdd() {
    setMessage(null);
    const input: Record<string, any> = { showId };
    if (newCompanyId) input.productionCompanyId = newCompanyId;
    if (newVenueIds.length > 0) input.venueIds = newVenueIds;
    if (newStartDate) input.startDate = new Date(newStartDate).toISOString();
    if (newEndDate) input.endDate = new Date(newEndDate).toISOString();

    const result = await executeRunCreate({ input });
    if (result.data?.runFindOrCreate?.error) {
      setMessage(result.data.runFindOrCreate.error);
    } else {
      setNewCompanyId(null);
      setNewVenueIds([]);
      setNewStartDate("");
      setNewEndDate("");
      setAdding(false);
      onChanged();
    }
  }

  function formatDate(iso: string | null): string {
    if (!iso) return "";
    return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  }

  return (
    <div className="space-y-2 border-t border-curtn-dark pt-3">
      <div className="flex items-center justify-between">
        <label className="block text-xs text-curtn-muted">Runs</label>
        {!adding && (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="text-[10px] text-curtn-coral hover:text-curtn-cream transition-colors cursor-pointer"
          >
            + Add Run
          </button>
        )}
      </div>

      {message && <p className="text-[10px] text-curtn-red">{message}</p>}

      {runs.length > 0 ? (
        <div className="space-y-1">
          {runs.map((run: any) => (
            <div key={run.id} className="flex items-center justify-between gap-2 py-1">
              <span className="text-xs text-curtn-cream">
                {run.effectiveTitle}
                {run.productionCompany?.name && (
                  <span className="text-curtn-muted ml-1.5">by {run.productionCompany.name}</span>
                )}
              </span>
              <span className="text-[10px] text-curtn-muted/50 shrink-0">
                {formatDate(run.startDate)}
                {run.startDate && run.endDate && " – "}
                {formatDate(run.endDate)}
              </span>
            </div>
          ))}
        </div>
      ) : (
        !adding && <p className="text-xs text-curtn-muted/50">No runs yet</p>
      )}

      {adding && (
        <div className="space-y-2 rounded-lg border border-curtn-dark bg-curtn-deep p-3">
          <div className="grid gap-2 sm:grid-cols-2">
            <RelationPicker
              label="Production Company"
              options={companyOptions}
              value={newCompanyId}
              onChange={setNewCompanyId}
              onCreateNew={handleCreateCompany}
              placeholder="Search companies..."
            />
            <RelationPicker
              label="Venues"
              multi
              options={venueOptions}
              value={newVenueIds}
              onChange={setNewVenueIds}
              onCreateNew={handleCreateVenue}
              placeholder="Search venues..."
            />
            <FieldEditor label="Start Date" value={newStartDate} onChange={setNewStartDate} type="date" />
            <FieldEditor label="End Date" value={newEndDate} onChange={setNewEndDate} type="date" />
          </div>
          <div className="flex gap-2">
            <Button variant="primary" onClick={handleAdd}>Add</Button>
            <Button variant="tertiary" onClick={() => { setAdding(false); setMessage(null); }}>Cancel</Button>
          </div>
        </div>
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
  const [confirmDelete, setConfirmDelete] = useState<any | null>(null);
  const [mergeSource, setMergeSource] = useState<any | null>(null);
  const [adding, setAdding] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [afterCursor, setAfterCursor] = useState<string | null>(null);
  const [allShows, setAllShows] = useState<any[]>([]);

  const [{ data, fetching }, reexecute] = useQuery({
    query: ADMIN_SHOW_LIST_QUERY,
    variables: { first: PAGE_SIZE, after: afterCursor, search: search || undefined },
  });
  const [, executeUpdate] = useMutation(SHOW_UPDATE_MUTATION);
  const [, executeDelete] = useMutation(SHOW_DELETE_MUTATION);
  const [, executeMerge] = useMutation(SHOW_MERGE_MUTATION);
  const [, executeCreate] = useMutation(SHOW_FIND_OR_CREATE_MUTATION);

  const pageNodes = data?.showList?.edges?.map((e: any) => e.node) || [];
  const pageInfo = data?.showList?.pageInfo;

  useEffect(() => {
    if (pageNodes.length > 0) {
      if (afterCursor) {
        setAllShows((prev) => {
          const ids = new Set(prev.map((n: any) => n.id));
          return [...prev, ...pageNodes.filter((n: any) => !ids.has(n.id))];
        });
      } else {
        setAllShows(pageNodes);
      }
    } else if (!fetching && !afterCursor) {
      setAllShows([]);
    }
  }, [data]); // eslint-disable-line react-hooks/exhaustive-deps

  const shows = allShows;

  function refreshList() {
    setAfterCursor(null);
    setAllShows([]);
    reexecute({ requestPolicy: "network-only" });
  }

  async function handleCreate() {
    if (!newTitle.trim()) return;
    setMessage(null);
    const result = await executeCreate({ input: { title: newTitle.trim() } });
    if (result.data?.showFindOrCreate?.error) {
      setMessage(result.data.showFindOrCreate.error);
    } else {
      setNewTitle("");
      setAdding(false);
      refreshList();
      if (result.data?.showFindOrCreate?.show?.id) {
        startEdit({ ...result.data.showFindOrCreate.show, performanceTypes: [], duration: 0 });
      }
    }
  }

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
      refreshList();
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
      refreshList();
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
      refreshList();
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <input
          value={search}
          onChange={(e) => { setSearch(e.target.value); setAfterCursor(null); setAllShows([]); }}
          placeholder="Search shows..."
          className="flex-1 rounded-lg border border-curtn-dark bg-curtn-deep px-3 py-2 text-sm text-curtn-cream focus:border-curtn-coral focus:outline-none"
        />
        <Button variant="primary" onClick={() => setAdding(!adding)}>
          {adding ? "Cancel" : "+ Add Show"}
        </Button>
      </div>
      {adding && (
        <Card className="space-y-3">
          <div className="flex gap-2 items-end">
            <div className="flex-1">
              <FieldEditor label="Title" value={newTitle} onChange={setNewTitle} />
            </div>
            <Button variant="primary" onClick={handleCreate}>Create</Button>
          </div>
        </Card>
      )}
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

                  {/* Runs */}
                  <RunsSection
                    showId={show.id}
                    runs={show.runs?.edges?.map((e: any) => e.node) || []}
                    onChanged={() => refreshList()}
                  />

                  <EntityDataSourcesPanel entityType="show" entityId={show.id} />

                  <div className="flex gap-2">
                    <Button variant="primary" onClick={handleSave}>Save</Button>
                    <Button variant="tertiary" onClick={() => setEditingId(null)}>Cancel</Button>
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
                      {show.runs?.edges?.length > 0 && (
                        <span>{show.runs.edges.length} run{show.runs.edges.length !== 1 ? "s" : ""}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Button variant="tertiary" onClick={() => startEdit(show)}>Edit</Button>
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
      {pageInfo?.hasNextPage && (
        <button
          type="button"
          onClick={() => setAfterCursor(pageInfo.endCursor)}
          disabled={fetching}
          className="w-full rounded-lg border border-curtn-dark bg-curtn-surface px-4 py-2.5 text-xs text-curtn-muted hover:text-curtn-cream hover:border-curtn-coral/50 transition-colors cursor-pointer disabled:opacity-50"
        >
          {fetching ? "Loading..." : "Load More"}
        </button>
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
  const [search, setSearch] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<any | null>(null);
  const [mergeSource, setMergeSource] = useState<any | null>(null);
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [afterCursor, setAfterCursor] = useState<string | null>(null);
  const [allVenues, setAllVenues] = useState<any[]>([]);

  const [{ data, fetching }, reexecute] = useQuery({
    query: ADMIN_VENUE_LIST_QUERY,
    variables: { first: PAGE_SIZE, after: afterCursor, search: search || undefined },
  });
  const [, executeUpdate] = useMutation(VENUE_UPDATE_MUTATION);
  const [, executeDelete] = useMutation(VENUE_DELETE_MUTATION);
  const [, executeMerge] = useMutation(VENUE_MERGE_MUTATION);
  const [, executeCreate] = useMutation(VENUE_FIND_OR_CREATE_MUTATION);

  const pageNodes = data?.venueList?.edges?.map((e: any) => e.node) || [];
  const pageInfo = data?.venueList?.pageInfo;

  useEffect(() => {
    if (pageNodes.length > 0) {
      if (afterCursor) {
        setAllVenues((prev) => {
          const ids = new Set(prev.map((n: any) => n.id));
          return [...prev, ...pageNodes.filter((n: any) => !ids.has(n.id))];
        });
      } else {
        setAllVenues(pageNodes);
      }
    } else if (!fetching && !afterCursor) {
      setAllVenues([]);
    }
  }, [data]); // eslint-disable-line react-hooks/exhaustive-deps

  const venues = allVenues;

  function refreshList() {
    setAfterCursor(null);
    setAllVenues([]);
    reexecute({ requestPolicy: "network-only" });
  }

  async function handleCreate() {
    if (!newName.trim()) return;
    setMessage(null);
    const result = await executeCreate({
      input: { name: newName.trim(), address: "TBD", city: "NYC", state: "NY", latitude: 40.7128, longitude: -74.006 },
    });
    if (result.data?.venueFindOrCreate?.error) {
      setMessage(result.data.venueFindOrCreate.error);
    } else {
      setNewName("");
      setAdding(false);
      refreshList();
      if (result.data?.venueFindOrCreate?.venue?.id) {
        startEdit({ ...result.data.venueFindOrCreate.venue, venueType: "theater" });
      }
    }
  }

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
      refreshList();
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
      refreshList();
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
      refreshList();
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
      <div className="flex gap-2">
        <input
          value={search}
          onChange={(e) => { setSearch(e.target.value); setAfterCursor(null); setAllVenues([]); }}
          placeholder="Search venues..."
          className="flex-1 rounded-lg border border-curtn-dark bg-curtn-deep px-3 py-2 text-sm text-curtn-cream focus:border-curtn-coral focus:outline-none"
        />
        <Button variant="primary" onClick={() => setAdding(!adding)}>
          {adding ? "Cancel" : "+ Add Venue"}
        </Button>
      </div>
      {adding && (
        <Card className="space-y-3">
          <div className="flex gap-2 items-end">
            <div className="flex-1">
              <FieldEditor label="Name" value={newName} onChange={setNewName} />
            </div>
            <Button variant="primary" onClick={handleCreate}>Create</Button>
          </div>
        </Card>
      )}
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
                  <EntityDataSourcesPanel entityType="venue" entityId={venue.id} />
                  <div className="flex gap-2">
                    <Button variant="primary" onClick={handleSave}>Save</Button>
                    <Button variant="tertiary" onClick={() => setEditingId(null)}>Cancel</Button>
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
                    <Button variant="tertiary" onClick={() => startEdit(venue)}>Edit</Button>
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
      {pageInfo?.hasNextPage && (
        <button
          type="button"
          onClick={() => setAfterCursor(pageInfo.endCursor)}
          disabled={fetching}
          className="w-full rounded-lg border border-curtn-dark bg-curtn-surface px-4 py-2.5 text-xs text-curtn-muted hover:text-curtn-cream hover:border-curtn-coral/50 transition-colors cursor-pointer disabled:opacity-50"
        >
          {fetching ? "Loading..." : "Load More"}
        </button>
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

// --- Credit Editor (inline within Run editing) ---
function CreditEditor({
  runId,
  cast,
  crew,
  onChanged,
}: {
  runId: string;
  cast: any[];
  crew: any[];
  onChanged: () => void;
}) {
  const [adding, setAdding] = useState(false);
  const [newRole, setNewRole] = useState("");
  const [newType, setNewType] = useState<"cast" | "crew">("cast");
  const [newPersonId, setNewPersonId] = useState<string | null>(null);
  const [newPersonName, setNewPersonName] = useState<string | null>(null);
  const [newPersonSearch, setNewPersonSearch] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  const [{ data: peopleData, fetching: peopleFetching }] = useQuery({
    query: PICKER_PEOPLE_QUERY,
    variables: { first: 200, search: newPersonSearch || undefined },
    pause: !adding,
  });
  const [, executeCreditAdd] = useMutation(CREDIT_ADD_MUTATION);
  const [, executeCreditRemove] = useMutation(CREDIT_REMOVE_MUTATION);

  const personOptions: RelationOption[] = [
    ...(newPersonName
      ? [{ id: "__new__", label: newPersonName, sublabel: "(new)" }]
      : []),
    ...(peopleData?.personList?.edges?.map((e: any) => ({
      id: e.node.id,
      label: e.node.name,
    })) || []),
  ];

  async function handleAdd() {
    if ((!newPersonId && !newPersonName) || !newRole) {
      setMessage("Person and role are required");
      return;
    }
    setMessage(null);
    const input: Record<string, any> = {
      runId,
      creditType: newType,
      role: newRole,
    };
    if (newPersonId && newPersonId !== "__new__") {
      input.personId = newPersonId;
    } else if (newPersonName) {
      input.personName = newPersonName;
    }
    const result = await executeCreditAdd({ input });
    if (result.data?.creditAdd?.error) {
      setMessage(result.data.creditAdd.error);
    } else {
      setNewRole("");
      setNewPersonId(null);
      setNewPersonName(null);
      setAdding(false);
      onChanged();
    }
  }

  async function handleRemove(creditId: string) {
    const result = await executeCreditRemove({
      input: { creditId },
    });
    if (result.data?.creditRemove?.error) {
      setMessage(result.data.creditRemove.error);
    } else {
      onChanged();
    }
  }

  function renderCreditRow(credit: any) {
    return (
      <div key={credit.id} className="flex items-center justify-between gap-2 py-1">
        <span className="text-xs text-curtn-cream">
          {credit.person?.name}
          <span className="text-curtn-muted ml-1.5">as {credit.role}</span>
        </span>
        <button
          type="button"
          onClick={() => handleRemove(credit.id)}
          className="text-[10px] text-curtn-muted hover:text-red-400 transition-colors cursor-pointer px-1"
        >
          x
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-2 border-t border-curtn-dark pt-3">
      <div className="flex items-center justify-between">
        <label className="block text-xs text-curtn-muted">Credits</label>
        {!adding && (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="text-[10px] text-curtn-coral hover:text-curtn-cream transition-colors cursor-pointer"
          >
            + Add Credit
          </button>
        )}
      </div>

      {message && <p className="text-[10px] text-curtn-red">{message}</p>}

      {cast.length > 0 && (
        <div>
          <p className="text-[10px] uppercase tracking-wider text-curtn-muted/60 mb-1">Cast</p>
          {cast.map(renderCreditRow)}
        </div>
      )}

      {crew.length > 0 && (
        <div>
          <p className="text-[10px] uppercase tracking-wider text-curtn-muted/60 mb-1">Crew</p>
          {crew.map(renderCreditRow)}
        </div>
      )}

      {cast.length === 0 && crew.length === 0 && !adding && (
        <p className="text-xs text-curtn-muted/50">No credits yet</p>
      )}

      {adding && (
        <div className="space-y-2 rounded-lg border border-curtn-dark bg-curtn-deep p-3">
          <div className="grid gap-2 sm:grid-cols-2">
            <RelationPicker
              label="Person"
              options={personOptions}
              value={newPersonId ?? (newPersonName ? "__new__" : null)}
              onChange={(id) => {
                if (id === "__new__") {
                  setNewPersonId("__new__");
                } else {
                  setNewPersonId(id);
                  setNewPersonName(null);
                }
              }}
              onSearch={setNewPersonSearch}
              onCreateNew={(name) => {
                setNewPersonName(name);
                setNewPersonId("__new__");
              }}
              loading={peopleFetching}
              placeholder="Search people..."
            />
            <FieldEditor
              label="Role"
              value={newRole}
              onChange={setNewRole}
            />
          </div>
          <FieldEditor
            label="Type"
            value={newType}
            onChange={(v) => setNewType(v as "cast" | "crew")}
            type="select"
            options={[
              { value: "cast", label: "Cast" },
              { value: "crew", label: "Crew" },
            ]}
          />
          <div className="flex gap-2">
            <Button variant="primary" onClick={handleAdd}>Add</Button>
            <Button variant="tertiary" onClick={() => { setAdding(false); setMessage(null); }}>Cancel</Button>
          </div>
        </div>
      )}
    </div>
  );
}

// --- Runs Tab ---
function RunsEditor() {
  const [search, setSearch] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [relShowId, setRelShowId] = useState<string | null>(null);
  const [relVenueIds, setRelVenueIds] = useState<string[]>([]);
  const [relCompanyId, setRelCompanyId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<any | null>(null);
  const [mergeSource, setMergeSource] = useState<any | null>(null);
  const [adding, setAdding] = useState(false);
  const [addShowId, setAddShowId] = useState<string | null>(null);
  const [afterCursor, setAfterCursor] = useState<string | null>(null);
  const [allRuns, setAllRuns] = useState<any[]>([]);

  const [{ data, fetching }, reexecute] = useQuery({
    query: ADMIN_RUN_LIST_QUERY,
    variables: { first: PAGE_SIZE, after: afterCursor, search: search || undefined },
  });
  const [{ data: showsData }, reexecuteShows] = useQuery({ query: PICKER_SHOWS_QUERY, variables: { first: 100 }, pause: !editingId && !adding });
  const [{ data: venuesData }, reexecuteVenues] = useQuery({ query: PICKER_VENUES_QUERY, variables: { first: 100 }, pause: !editingId });
  const [{ data: companiesData }, reexecuteCompanies] = useQuery({ query: PICKER_COMPANIES_QUERY, variables: { first: 100 }, pause: !editingId });
  const [, executeUpdate] = useMutation(RUN_UPDATE_MUTATION);
  const [, executeDelete] = useMutation(RUN_DELETE_MUTATION);
  const [, executeMerge] = useMutation(RUN_MERGE_MUTATION);
  const [, executeShowCreate] = useMutation(SHOW_FIND_OR_CREATE_MUTATION);
  const [, executeVenueCreate] = useMutation(VENUE_FIND_OR_CREATE_MUTATION);
  const [, executeCompanyCreate] = useMutation(PRODUCTION_COMPANY_CREATE_MUTATION);
  const [, executeRunCreate] = useMutation(RUN_FIND_OR_CREATE_MUTATION);

  const pageNodes = data?.runList?.edges?.map((e: any) => e.node) || [];
  const pageInfo = data?.runList?.pageInfo;

  useEffect(() => {
    if (pageNodes.length > 0) {
      if (afterCursor) {
        setAllRuns((prev) => {
          const ids = new Set(prev.map((n: any) => n.id));
          return [...prev, ...pageNodes.filter((n: any) => !ids.has(n.id))];
        });
      } else {
        setAllRuns(pageNodes);
      }
    } else if (!fetching && !afterCursor) {
      setAllRuns([]);
    }
  }, [data]); // eslint-disable-line react-hooks/exhaustive-deps

  const runs = allRuns;

  function refreshList() {
    setAfterCursor(null);
    setAllRuns([]);
    reexecute({ requestPolicy: "network-only" });
  }

  const currentRun = editingId ? runs.find((r: any) => r.id === editingId) : null;

  function mergeSelected<T extends RelationOption>(base: T[], extras: T[]): T[] {
    const seen = new Set(base.map((o) => o.id));
    const merged = [...base];
    for (const extra of extras) {
      if (!seen.has(extra.id)) {
        merged.push(extra);
        seen.add(extra.id);
      }
    }
    return merged;
  }

  const showOptions: RelationOption[] = mergeSelected(
    showsData?.showList?.edges?.map((e: any) => ({ id: e.node.id, label: e.node.title })) || [],
    currentRun?.show ? [{ id: currentRun.show.id, label: currentRun.show.title }] : []
  );
  const venueOptions: RelationOption[] = mergeSelected(
    venuesData?.venueList?.edges?.map((e: any) => ({
      id: e.node.id,
      label: e.node.name,
      sublabel: e.node.city,
    })) || [],
    (currentRun?.venues || []).map((v: any) => ({ id: v.id, label: v.name }))
  );
  const companyOptions: RelationOption[] = mergeSelected(
    companiesData?.productionCompanyList?.edges?.map((e: any) => ({
      id: e.node.id,
      label: e.node.name,
    })) || [],
    currentRun?.productionCompany
      ? [{ id: currentRun.productionCompany.id, label: currentRun.productionCompany.name }]
      : []
  );

  async function handleCreateShow(title: string) {
    const result = await executeShowCreate({ input: { title } });
    if (result.data?.showFindOrCreate?.show?.id) {
      setRelShowId(result.data.showFindOrCreate.show.id);
      reexecuteShows({ requestPolicy: "network-only" });
    } else if (result.data?.showFindOrCreate?.error) {
      setMessage(result.data.showFindOrCreate.error);
    }
  }

  async function handleCreateVenue(name: string) {
    const result = await executeVenueCreate({
      input: { name, address: "TBD", city: "NYC", state: "NY", latitude: 40.7128, longitude: -74.006 },
    });
    if (result.data?.venueFindOrCreate?.venue?.id) {
      const newId = result.data.venueFindOrCreate.venue.id;
      setRelVenueIds((prev) => [...prev, newId]);
      reexecuteVenues({ requestPolicy: "network-only" });
    } else if (result.data?.venueFindOrCreate?.error) {
      setMessage(result.data.venueFindOrCreate.error);
    }
  }

  async function handleCreateCompany(name: string) {
    const result = await executeCompanyCreate({ input: { name } });
    if (result.data?.productionCompanyCreate?.productionCompany?.id) {
      setRelCompanyId(result.data.productionCompanyCreate.productionCompany.id);
      reexecuteCompanies({ requestPolicy: "network-only" });
    } else if (result.data?.productionCompanyCreate?.error) {
      setMessage(result.data.productionCompanyCreate.error);
    }
  }

  async function handleCreateShowForAdd(title: string) {
    const result = await executeShowCreate({ input: { title } });
    if (result.data?.showFindOrCreate?.show?.id) {
      setAddShowId(result.data.showFindOrCreate.show.id);
      reexecuteShows({ requestPolicy: "network-only" });
    }
  }

  async function handleAddRun() {
    if (!addShowId) {
      setMessage("Pick a show for the new run");
      return;
    }
    setMessage(null);
    const result = await executeRunCreate({ input: { showId: addShowId } });
    if (result.data?.runFindOrCreate?.error) {
      setMessage(result.data.runFindOrCreate.error);
    } else {
      setAddShowId(null);
      setAdding(false);
      refreshList();
      if (result.data?.runFindOrCreate?.run?.id) {
        startEdit({
          ...result.data.runFindOrCreate.run,
          cast: [],
          crew: [],
        });
      }
    }
  }

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
    setRelShowId(run.show?.id || null);
    setRelVenueIds(run.venues?.map((v: any) => v.id) || []);
    setRelCompanyId(run.productionCompany?.id || null);
  }

  async function handleSave() {
    if (!editingId) return;
    setMessage(null);
    const input: Record<string, any> = {
      runId: decodeGlobalId(editingId),
      ...fields,
      startDate: fields.startDate ? new Date(fields.startDate).toISOString() : undefined,
      endDate: fields.endDate ? new Date(fields.endDate).toISOString() : undefined,
    };

    if (relShowId) input.showId = decodeGlobalId(relShowId);
    input.venueIds = JSON.stringify(relVenueIds.map(decodeGlobalId));
    input.productionCompanyId = relCompanyId ? decodeGlobalId(relCompanyId) : "";

    const result = await executeUpdate({ input });
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
      <div className="flex gap-2">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search runs..."
          className="flex-1 rounded-lg border border-curtn-dark bg-curtn-deep px-3 py-2 text-sm text-curtn-cream focus:border-curtn-coral focus:outline-none"
        />
        <Button variant="primary" onClick={() => setAdding(!adding)}>
          {adding ? "Cancel" : "+ Add Run"}
        </Button>
      </div>
      {adding && (
        <Card className="space-y-3">
          <RelationPicker
            label="Show"
            options={showOptions}
            value={addShowId}
            onChange={setAddShowId}
            onCreateNew={handleCreateShowForAdd}
            placeholder="Search shows..."
          />
          <Button variant="primary" onClick={handleAddRun}>Create Run</Button>
        </Card>
      )}
      {message && <p className="text-xs text-curtn-coral">{message}</p>}
      {fetching && !data ? (
        <p className="text-sm text-curtn-muted">Loading...</p>
      ) : (
        <div className="space-y-2">
          {runs.map((run: any) => (
            <Card key={run.id} className="space-y-3">
              {editingId === run.id ? (
                <div className="space-y-3">
                  {/* Relations */}
                  <div className="grid gap-3 sm:grid-cols-2">
                    <RelationPicker
                      label="Show"
                      options={showOptions}
                      value={relShowId}
                      onChange={setRelShowId}
                      onCreateNew={handleCreateShow}
                      placeholder="Search shows..."
                    />
                    <RelationPicker
                      label="Production Company"
                      options={companyOptions}
                      value={relCompanyId}
                      onChange={setRelCompanyId}
                      onCreateNew={handleCreateCompany}
                      placeholder="Search companies..."
                    />
                    <div className="sm:col-span-2">
                      <RelationPicker
                        label="Venues"
                        multi
                        options={venueOptions}
                        value={relVenueIds}
                        onChange={setRelVenueIds}
                        onCreateNew={handleCreateVenue}
                        placeholder="Search venues..."
                      />
                    </div>
                  </div>

                  {/* Fields */}
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

                  {/* Credits */}
                  <CreditEditor
                    runId={run.id}
                    cast={run.cast || []}
                    crew={run.crew || []}
                    onChanged={() => reexecute({ requestPolicy: "network-only" })}
                  />

                  <EntityDataSourcesPanel entityType="run" entityId={run.id} />

                  <div className="flex gap-2">
                    <Button variant="primary" onClick={handleSave}>Save</Button>
                    <Button variant="tertiary" onClick={() => setEditingId(null)}>Cancel</Button>
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
                    {(run.cast?.length > 0 || run.crew?.length > 0) && (
                      <p className="text-[10px] text-curtn-muted/50 mt-0.5">
                        {run.cast?.length > 0 && `${run.cast.length} cast`}
                        {run.cast?.length > 0 && run.crew?.length > 0 && " · "}
                        {run.crew?.length > 0 && `${run.crew.length} crew`}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Button variant="tertiary" onClick={() => startEdit(run)}>Edit</Button>
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
  const [search, setSearch] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [relRunId, setRelRunId] = useState<string | null>(null);
  const [relVenueId, setRelVenueId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<any | null>(null);
  const [mergeSource, setMergeSource] = useState<any | null>(null);
  const [creatingRun, setCreatingRun] = useState(false);
  const [newRunShowId, setNewRunShowId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [addRunId, setAddRunId] = useState<string | null>(null);
  const [addVenueId, setAddVenueId] = useState<string | null>(null);
  const [addDate, setAddDate] = useState("");
  const [addTime, setAddTime] = useState("");

  const [{ data, fetching }, reexecute] = useQuery({
    query: ADMIN_PERFORMANCE_LIST_QUERY,
    variables: { first: 200, search: search || undefined },
  });
  const [{ data: runsData }, reexecuteRuns] = useQuery({ query: PICKER_RUNS_QUERY, variables: { first: 100 }, pause: !editingId && !adding });
  const [{ data: venuesData }, reexecuteVenues] = useQuery({ query: PICKER_VENUES_QUERY, variables: { first: 100 }, pause: !editingId && !adding });
  const [{ data: showsData }] = useQuery({ query: PICKER_SHOWS_QUERY, variables: { first: 100 }, pause: !creatingRun });
  const [, executeUpdate] = useMutation(PERFORMANCE_UPDATE_MUTATION);
  const [, executeDelete] = useMutation(PERFORMANCE_DELETE_MUTATION);
  const [, executeMerge] = useMutation(PERFORMANCE_MERGE_MUTATION);
  const [, executeVenueCreate] = useMutation(VENUE_FIND_OR_CREATE_MUTATION);
  const [, executeRunCreate] = useMutation(RUN_FIND_OR_CREATE_MUTATION);
  const [, executeShowCreate] = useMutation(SHOW_FIND_OR_CREATE_MUTATION);

  const performances = data?.performanceList?.edges?.map((e: any) => e.node) || [];

  const runOptions: RelationOption[] =
    runsData?.runList?.edges?.map((e: any) => ({
      id: e.node.id,
      label: e.node.effectiveTitle,
      sublabel: e.node.productionCompany?.name,
    })) || [];
  const venueOptions: RelationOption[] =
    venuesData?.venueList?.edges?.map((e: any) => ({
      id: e.node.id,
      label: e.node.name,
      sublabel: e.node.city,
    })) || [];
  const showOptions: RelationOption[] =
    showsData?.showList?.edges?.map((e: any) => ({ id: e.node.id, label: e.node.title })) || [];

  async function handleCreateVenue(name: string) {
    const result = await executeVenueCreate({
      input: { name, address: "TBD", city: "NYC", state: "NY", latitude: 40.7128, longitude: -74.006 },
    });
    if (result.data?.venueFindOrCreate?.venue?.id) {
      setRelVenueId(result.data.venueFindOrCreate.venue.id);
      reexecuteVenues({ requestPolicy: "network-only" });
    } else if (result.data?.venueFindOrCreate?.error) {
      setMessage(result.data.venueFindOrCreate.error);
    }
  }

  async function handleCreateRun() {
    if (!newRunShowId) {
      setMessage("Pick a show for the new run");
      return;
    }
    setMessage(null);
    const result = await executeRunCreate({ input: { showId: newRunShowId } });
    if (result.data?.runFindOrCreate?.run?.id) {
      setRelRunId(result.data.runFindOrCreate.run.id);
      reexecuteRuns({ requestPolicy: "network-only" });
      setCreatingRun(false);
      setNewRunShowId(null);
    } else if (result.data?.runFindOrCreate?.error) {
      setMessage(result.data.runFindOrCreate.error);
    }
  }

  async function handleCreateShowForRun(title: string) {
    const result = await executeShowCreate({ input: { title } });
    if (result.data?.showFindOrCreate?.show?.id) {
      setNewRunShowId(result.data.showFindOrCreate.show.id);
    }
  }

  const [, executePerformanceCreate] = useMutation(PERFORMANCE_CREATE_MUTATION);

  async function handleCreateVenueForAdd(name: string) {
    const result = await executeVenueCreate({
      input: { name, address: "TBD", city: "NYC", state: "NY", latitude: 40.7128, longitude: -74.006 },
    });
    if (result.data?.venueFindOrCreate?.venue?.id) {
      setAddVenueId(result.data.venueFindOrCreate.venue.id);
      reexecuteVenues({ requestPolicy: "network-only" });
    }
  }

  async function handleAddPerformance() {
    if (!addRunId) {
      setMessage("Pick a run for the new performance");
      return;
    }
    setMessage(null);
    const input: Record<string, any> = { runId: addRunId };
    if (addVenueId) input.venueId = addVenueId;
    if (addDate) input.date = new Date(addDate).toISOString();
    if (addTime) input.time = addTime;

    const result = await executePerformanceCreate({ input });
    if (result.data?.performanceCreate?.error) {
      setMessage(result.data.performanceCreate.error);
    } else {
      setAddRunId(null);
      setAddVenueId(null);
      setAddDate("");
      setAddTime("");
      setAdding(false);
      reexecute({ requestPolicy: "network-only" });
      if (result.data?.performanceCreate?.performance?.id) {
        startEdit(result.data.performanceCreate.performance);
      }
    }
  }

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
    setRelRunId(perf.run?.id || null);
    setRelVenueId(perf.venue?.id || null);
  }

  async function handleSave() {
    if (!editingId) return;
    setMessage(null);
    const input: Record<string, any> = {
      performanceId: decodeGlobalId(editingId),
      date: fields.date ? new Date(fields.date).toISOString() : undefined,
      time: fields.time,
      ticketUrl: fields.ticketUrl,
      soldOut: fields.soldOut === "true",
      description: fields.description,
    };

    if (relRunId) input.runId = decodeGlobalId(relRunId);
    if (relVenueId) input.venueId = decodeGlobalId(relVenueId);

    const result = await executeUpdate({ input });
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
      <div className="flex gap-2">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search performances..."
          className="flex-1 rounded-lg border border-curtn-dark bg-curtn-deep px-3 py-2 text-sm text-curtn-cream focus:border-curtn-coral focus:outline-none"
        />
        <Button variant="primary" onClick={() => setAdding(!adding)}>
          {adding ? "Cancel" : "+ Add Performance"}
        </Button>
      </div>
      {adding && (
        <Card className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <RelationPicker
              label="Run"
              options={runOptions}
              value={addRunId}
              onChange={setAddRunId}
              placeholder="Search runs..."
            />
            <RelationPicker
              label="Venue"
              options={venueOptions}
              value={addVenueId}
              onChange={setAddVenueId}
              onCreateNew={handleCreateVenueForAdd}
              placeholder="Search venues..."
            />
            <FieldEditor label="Date" value={addDate} onChange={setAddDate} type="date" />
            <FieldEditor label="Time" value={addTime} onChange={setAddTime} />
          </div>
          <Button variant="primary" onClick={handleAddPerformance}>Create Performance</Button>
        </Card>
      )}
      {message && <p className="text-xs text-curtn-coral">{message}</p>}
      {fetching && !data ? (
        <p className="text-sm text-curtn-muted">Loading...</p>
      ) : (
        <div className="space-y-2">
          {performances.map((perf: any) => (
            <Card key={perf.id} className="space-y-3">
              {editingId === perf.id ? (
                <div className="space-y-3">
                  {/* Relations */}
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <RelationPicker
                        label="Run"
                        options={runOptions}
                        value={relRunId}
                        onChange={(id) => { setRelRunId(id); setCreatingRun(false); }}
                        onCreateNew={() => setCreatingRun(true)}
                        placeholder="Search runs..."
                      />
                      {creatingRun && (
                        <div className="mt-2 space-y-2 rounded-lg border border-curtn-dark bg-curtn-deep p-2.5">
                          <p className="text-[10px] uppercase tracking-wider text-curtn-muted/60">New run for show:</p>
                          <RelationPicker
                            label="Show"
                            options={showOptions}
                            value={newRunShowId}
                            onChange={setNewRunShowId}
                            onCreateNew={handleCreateShowForRun}
                            placeholder="Search shows..."
                          />
                          <div className="flex gap-2">
                            <Button variant="primary" onClick={handleCreateRun}>Create Run</Button>
                            <Button variant="tertiary" onClick={() => { setCreatingRun(false); setNewRunShowId(null); }}>Cancel</Button>
                          </div>
                        </div>
                      )}
                    </div>
                    <RelationPicker
                      label="Venue"
                      options={venueOptions}
                      value={relVenueId}
                      onChange={setRelVenueId}
                      onCreateNew={handleCreateVenue}
                      placeholder="Search venues..."
                    />
                  </div>

                  {/* Fields */}
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

                  {/* Credits (from parent run, with performance overrides) */}
                  <CreditEditor
                    runId={perf.run?.id}
                    cast={perf.effectiveCast || []}
                    crew={perf.effectiveCrew || []}
                    onChanged={() => reexecute({ requestPolicy: "network-only" })}
                  />

                  <div className="flex gap-2">
                    <Button variant="primary" onClick={handleSave}>Save</Button>
                    <Button variant="tertiary" onClick={() => setEditingId(null)}>Cancel</Button>
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
                    {(perf.effectiveCast?.length > 0 || perf.effectiveCrew?.length > 0) && (
                      <p className="text-[10px] text-curtn-muted/50 mt-0.5">
                        {perf.effectiveCast?.length > 0 && `${perf.effectiveCast.length} cast`}
                        {perf.effectiveCast?.length > 0 && perf.effectiveCrew?.length > 0 && " · "}
                        {perf.effectiveCrew?.length > 0 && `${perf.effectiveCrew.length} crew`}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Button variant="tertiary" onClick={() => startEdit(perf)}>Edit</Button>
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
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");

  const [{ data, fetching }, reexecute] = useQuery({
    query: ADMIN_PERSON_LIST_QUERY,
    variables: { first: 200, search: search || undefined },
  });
  const [, executeUpdate] = useMutation(PERSON_UPDATE_MUTATION);
  const [, executeDelete] = useMutation(PERSON_DELETE_MUTATION);
  const [, executeMerge] = useMutation(PERSON_MERGE_MUTATION);
  const [, executeCreate] = useMutation(PERSON_CREATE_MUTATION);

  const people = data?.personList?.edges?.map((e: any) => e.node) || [];

  async function handleCreate() {
    if (!newName.trim()) return;
    setMessage(null);
    const result = await executeCreate({ input: { name: newName.trim() } });
    if (result.data?.personCreate?.error) {
      setMessage(result.data.personCreate.error);
    } else {
      setNewName("");
      setAdding(false);
      reexecute({ requestPolicy: "network-only" });
      if (result.data?.personCreate?.person?.id) {
        startEdit({ ...result.data.personCreate.person, bio: "", headshotUrl: "", wikidataId: "" });
      }
    }
  }

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
      <div className="flex gap-2">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search people..."
          className="flex-1 rounded-lg border border-curtn-dark bg-curtn-deep px-3 py-2 text-sm text-curtn-cream focus:border-curtn-coral focus:outline-none"
        />
        <Button variant="primary" onClick={() => setAdding(!adding)}>
          {adding ? "Cancel" : "+ Add Person"}
        </Button>
      </div>
      {adding && (
        <Card className="space-y-3">
          <div className="flex gap-2 items-end">
            <div className="flex-1">
              <FieldEditor label="Name" value={newName} onChange={setNewName} />
            </div>
            <Button variant="primary" onClick={handleCreate}>Create</Button>
          </div>
        </Card>
      )}
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
                    <Button variant="tertiary" onClick={() => setEditingId(null)}>Cancel</Button>
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
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-medium text-curtn-cream truncate">{person.name}</h3>
                        {person.isClaimed && (
                          <span className="inline-block rounded-full bg-green-500/20 px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wider text-green-400 shrink-0">
                            Claimed{person.user?.username ? ` by @${person.user.username}` : ""}
                          </span>
                        )}
                      </div>
                      {person.bio && (
                        <p className="text-xs text-curtn-muted mt-0.5 truncate">{person.bio}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Button variant="tertiary" onClick={() => startEdit(person)}>Edit</Button>
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
