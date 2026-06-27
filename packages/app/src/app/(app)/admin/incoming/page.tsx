"use client";

import { useState } from "react";
import { useQuery, useMutation } from "urql";
import {
  PENDING_IMPORTS_QUERY,
  APPROVE_PENDING_IMPORT_MUTATION,
  REJECT_PENDING_IMPORT_MUTATION,
  EDIT_PENDING_IMPORT_MUTATION,
  AUTO_VALIDATE_MUTATION,
  APPROVE_ALL_MUTATION,
  FLAG_SCRAPER_ISSUE_MUTATION,
  SCRAPER_ISSUE_CATEGORIES,
} from "@/lib/graphql/admin";
import { Button } from "@/components/Button";

interface CreditEntry {
  name: string;
  role: string | null;
  headshotUrl: string | null;
}

interface PendingImportNode {
  id: string;
  status: string;
  title: string;
  runTitle: string | null;
  showDescription: string | null;
  runDescription: string | null;
  performanceDescription: string | null;
  performanceTypes: string[] | null;
  duration: number | null;
  date: string | null;
  time: string | null;
  venueName: string | null;
  stageName: string | null;
  companyName: string | null;
  ticketUrl: string | null;
  imageUrl: string | null;
  cast: CreditEntry[];
  crew: CreditEntry[];
  importedAt: string;
  reviewedAt: string | null;
  error: string | null;
  dataSource: { id: string; name: string };
}

type StatusFilter = "pending" | "approved" | "rejected" | "flagged" | "all";
type RowAction = "approve" | "reject";

export default function IncomingEventsPage() {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("pending");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editFields, setEditFields] = useState<Record<string, string>>({});
  const [selected, setSelected] = useState<Set<string>>(new Set());
  // Anchor for shift-click range selection across pending rows
  const [lastSelectedId, setLastSelectedId] = useState<string | null>(null);
  // Per-row in-flight tracking. id → action being performed
  const [rowBusy, setRowBusy] = useState<Record<string, RowAction>>({});
  // Per-row error messages set by the latest action on that row
  const [rowError, setRowError] = useState<Record<string, string>>({});
  // Top-level message reserved for bulk operations only
  const [bulkMessage, setBulkMessage] = useState<string | null>(null);
  // Bulk reject loops the single-reject mutation, so track in-flight here
  const [rejectingSelected, setRejectingSelected] = useState(false);
  // Scraper-issue flag modal state (bulk: applies to the current selection)
  const [flaggingBulk, setFlaggingBulk] = useState(false);
  const [flagCats, setFlagCats] = useState<Set<string>>(new Set());
  const [flagNote, setFlagNote] = useState("");
  const [flagBusy, setFlagBusy] = useState(false);
  const [flagMsg, setFlagMsg] = useState<string | null>(null);

  const [{ data, fetching }, reexecuteQuery] = useQuery({
    query: PENDING_IMPORTS_QUERY,
    variables: {
      status: statusFilter === "all" ? undefined : statusFilter,
      first: 100,
    },
  });

  const [, executeApprove] = useMutation(APPROVE_PENDING_IMPORT_MUTATION);
  const [, executeReject] = useMutation(REJECT_PENDING_IMPORT_MUTATION);
  const [, executeEdit] = useMutation(EDIT_PENDING_IMPORT_MUTATION);
  const [{ fetching: validating }, executeAutoValidate] = useMutation(
    AUTO_VALIDATE_MUTATION
  );
  const [{ fetching: approvingAll }, executeApproveAll] = useMutation(
    APPROVE_ALL_MUTATION
  );
  const [, executeFlag] = useMutation(FLAG_SCRAPER_ISSUE_MUTATION);

  function openBulkFlag() {
    if (selected.size === 0) {
      setBulkMessage("No items selected to flag.");
      return;
    }
    setFlaggingBulk(true);
    setFlagCats(new Set());
    setFlagNote("");
    setFlagMsg(null);
  }

  function toggleFlagCat(value: string) {
    setFlagCats((prev) => {
      const next = new Set(prev);
      if (next.has(value)) next.delete(value);
      else next.add(value);
      return next;
    });
  }

  async function submitFlag() {
    const ids = Array.from(selected);
    if (ids.length === 0) {
      setFlaggingBulk(false);
      return;
    }
    if (flagCats.size === 0 && !flagNote.trim()) {
      setFlagMsg("Pick at least one category or add a note.");
      return;
    }
    setFlagBusy(true);
    setFlagMsg(null);
    const categories = Array.from(flagCats);
    const note = flagNote.trim() || undefined;
    let flagged = 0;
    let errors = 0;
    for (const id of ids) {
      const result = await executeFlag({
        input: { pendingImportId: decodeGlobalId(id), categories, note },
      });
      if (result.error || result.data?.flagScraperIssue?.error) errors += 1;
      else flagged += 1;
    }
    setFlagBusy(false);
    setFlaggingBulk(false);
    setSelected(new Set());
    setBulkMessage(
      `Flagged ${flagged}${errors ? `, ${errors} error${errors === 1 ? "" : "s"}` : ""}.`
    );
    // Flagged rows move to the 'flagged' status — refetch so they drop out of
    // the pending list.
    reexecuteQuery({ requestPolicy: "network-only" });
  }

  const items: PendingImportNode[] =
    data?.pendingImports?.edges?.map((e: { node: PendingImportNode }) => e.node) || [];
  const pendingItems = items.filter((i) => i.status === "pending");
  const selectableIds = pendingItems.map((i) => i.id);
  const allSelected =
    selectableIds.length > 0 &&
    selectableIds.every((id) => selected.has(id));
  const partiallySelected = selected.size > 0 && !allSelected;

  function decodeGlobalId(globalId: string): string {
    return atob(globalId).split(":")[1];
  }

  function setBusy(id: string, action: RowAction | null) {
    setRowBusy((prev) => {
      const next = { ...prev };
      if (action === null) delete next[id];
      else next[id] = action;
      return next;
    });
  }

  function setError(id: string, message: string | null) {
    setRowError((prev) => {
      const next = { ...prev };
      if (message === null) delete next[id];
      else next[id] = message;
      return next;
    });
  }

  async function handleApprove(item: PendingImportNode) {
    setBusy(item.id, "approve");
    setError(item.id, null);
    const result = await executeApprove({
      input: { pendingImportId: decodeGlobalId(item.id) },
    });
    setBusy(item.id, null);
    if (result.data?.approvePendingImport?.error) {
      setError(item.id, result.data.approvePendingImport.error);
    } else {
      setSelected((prev) => {
        const next = new Set(prev);
        next.delete(item.id);
        return next;
      });
      reexecuteQuery({ requestPolicy: "network-only" });
    }
  }

  async function handleReject(item: PendingImportNode) {
    setBusy(item.id, "reject");
    setError(item.id, null);
    const result = await executeReject({
      input: { pendingImportId: decodeGlobalId(item.id) },
    });
    setBusy(item.id, null);
    if (result.data?.rejectPendingImport?.error) {
      setError(item.id, result.data.rejectPendingImport.error);
    } else {
      reexecuteQuery({ requestPolicy: "network-only" });
    }
  }

  function startEditing(item: PendingImportNode) {
    setEditingId(item.id);
    setEditFields({
      title: item.title,
      runTitle: item.runTitle || "",
      venueName: item.venueName || "",
      stageName: item.stageName || "",
      companyName: item.companyName || "",
      date: item.date ? item.date.split("T")[0] : "",
      time: item.time || "",
      ticketUrl: item.ticketUrl || "",
      showDescription: item.showDescription || "",
      runDescription: item.runDescription || "",
      performanceDescription: item.performanceDescription || "",
    });
  }

  async function handleSaveEdit() {
    if (!editingId) return;
    const id = editingId;
    setError(id, null);
    const result = await executeEdit({
      input: {
        pendingImportId: decodeGlobalId(id),
        ...editFields,
        date: editFields.date ? new Date(editFields.date).toISOString() : undefined,
      },
    });
    if (result.data?.editPendingImport?.error) {
      setError(id, result.data.editPendingImport.error);
    } else {
      setEditingId(null);
      reexecuteQuery({ requestPolicy: "network-only" });
    }
  }

  async function handleAutoValidate() {
    setBulkMessage(null);
    const result = await executeAutoValidate({ input: {} });
    const d = result.data?.autoValidatePendingImports;
    if (d?.error) {
      setBulkMessage(d.error);
    } else if (d) {
      setBulkMessage(
        `Auto-validated: ${d.approvedCount} approved, ${d.errorCount} errors`
      );
      reexecuteQuery({ requestPolicy: "network-only" });
    }
  }

  async function handleBulkApprove(targetIds?: string[]) {
    const ids = targetIds ?? Array.from(selected);
    const usingSelection = ids.length > 0;
    const count = usingSelection ? ids.length : pendingItems.length;
    if (count === 0) {
      setBulkMessage("No pending items to approve.");
      return;
    }
    const verb = usingSelection ? `${count} selected` : `all ${count}`;
    if (
      !window.confirm(
        `Approve ${verb} pending items? This creates Show / Run / Performance records and can't be undone in bulk.`
      )
    ) {
      return;
    }
    setBulkMessage(null);
    const decodedIds = usingSelection
      ? ids.map((id) => decodeGlobalId(id))
      : undefined;
    const result = await executeApproveAll({
      input: decodedIds ? { pendingImportIds: decodedIds } : {},
    });
    const d = result.data?.approveAllPendingImports;
    if (d?.error) {
      setBulkMessage(d.error);
    } else if (d) {
      const errorTail = d.firstErrors?.length
        ? ` First errors: ${d.firstErrors.join(" | ")}`
        : "";
      setBulkMessage(
        `Approved ${d.approvedCount}, ${d.errorCount} errors.${errorTail}`
      );
      setSelected(new Set());
      reexecuteQuery({ requestPolicy: "network-only" });
    }
  }

  async function handleBulkReject() {
    const ids = Array.from(selected);
    if (ids.length === 0) {
      setBulkMessage("No items selected to reject.");
      return;
    }
    if (
      !window.confirm(
        `Reject ${ids.length} selected item${ids.length === 1 ? "" : "s"}? They'll move to the Rejected filter and stay out of the catalog.`
      )
    ) {
      return;
    }
    setBulkMessage(null);
    setRejectingSelected(true);
    let rejected = 0;
    let errors = 0;
    for (const id of ids) {
      const result = await executeReject({
        input: { pendingImportId: decodeGlobalId(id) },
      });
      if (result.data?.rejectPendingImport?.error) errors += 1;
      else rejected += 1;
    }
    setRejectingSelected(false);
    setBulkMessage(
      `Rejected ${rejected}${errors ? `, ${errors} error${errors === 1 ? "" : "s"}` : ""}.`
    );
    setSelected(new Set());
    reexecuteQuery({ requestPolicy: "network-only" });
  }

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleRowCheckboxClick(
    e: React.MouseEvent<HTMLInputElement>,
    id: string
  ) {
    if (e.shiftKey && lastSelectedId && lastSelectedId !== id) {
      const a = selectableIds.indexOf(lastSelectedId);
      const b = selectableIds.indexOf(id);
      if (a !== -1 && b !== -1) {
        e.preventDefault();
        const [start, end] = a < b ? [a, b] : [b, a];
        const range = selectableIds.slice(start, end + 1);
        setSelected((prev) => {
          const next = new Set(prev);
          for (const r of range) next.add(r);
          return next;
        });
      }
    }
    setLastSelectedId(id);
  }

  function toggleSelectAll() {
    if (allSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(selectableIds));
    }
  }

  function formatDate(iso: string | null): string {
    if (!iso) return "—";
    return new Date(iso).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "2-digit",
    });
  }

  function timeSince(iso: string): string {
    const diff = Date.now() - new Date(iso).getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    if (hours < 1) return "just now";
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  }

  return (
    <div className="px-6 py-8 max-w-7xl mx-auto space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-curtn-cream">Incoming Events</h1>
          <p className="mt-1 text-sm text-curtn-muted">
            Review events imported from feeds. Items older than 1 day auto-approve.
          </p>
        </div>
        <div className="flex gap-2">
          {selected.size > 0 && (
            <>
              <Button
                variant="primary"
                onClick={() => handleBulkApprove()}
                disabled={validating || approvingAll || rejectingSelected}
              >
                {approvingAll ? "Approving..." : `Approve ${selected.size} Selected`}
              </Button>
              <Button
                variant="secondary"
                onClick={handleBulkReject}
                disabled={validating || approvingAll || rejectingSelected}
              >
                {rejectingSelected
                  ? "Rejecting..."
                  : `Reject ${selected.size} Selected`}
              </Button>
              <Button
                variant="tertiary"
                onClick={openBulkFlag}
                disabled={validating || approvingAll || rejectingSelected || flagBusy}
              >
                {flagBusy ? "Flagging..." : `Flag ${selected.size} Selected`}
              </Button>
            </>
          )}
          <Button
            variant="secondary"
            onClick={handleAutoValidate}
            disabled={validating || approvingAll || rejectingSelected}
          >
            {validating ? "Validating..." : "Auto-Validate"}
          </Button>
          <Button
            variant="secondary"
            onClick={() => handleBulkApprove(selectableIds)}
            disabled={
              validating ||
              approvingAll ||
              rejectingSelected ||
              pendingItems.length === 0
            }
          >
            {approvingAll ? "Approving..." : "Approve All"}
          </Button>
        </div>
      </div>

      {bulkMessage && (
        <div className="border border-curtn-dark bg-curtn-surface px-4 py-3 text-sm text-curtn-cream">
          {bulkMessage}
        </div>
      )}

      {/* Status filter tabs */}
      <div className="flex gap-1 bg-curtn-surface p-1">
        {(["pending", "approved", "rejected", "flagged", "all"] as StatusFilter[]).map((s) => (
          <button
            key={s}
            onClick={() => {
              setStatusFilter(s);
              setSelected(new Set());
              setLastSelectedId(null);
            }}
            className={`px-3 py-1.5 text-xs uppercase tracking-wider transition ${
              statusFilter === s
                ? "bg-curtn-coral text-curtn-deep"
                : "text-curtn-muted hover:text-curtn-cream"
            }`}
          >
            {s} {s === statusFilter && items.length > 0 && `(${items.length})`}
          </button>
        ))}
      </div>

      {fetching && !data ? (
        <p className="text-sm text-curtn-muted">Loading...</p>
      ) : items.length === 0 ? (
        <div className="border border-curtn-dark bg-curtn-surface px-4 py-12 text-center">
          <p className="text-sm text-curtn-muted">
            {statusFilter === "pending"
              ? "No pending events. Poll a data source to import new events."
              : "No events match this filter."}
          </p>
        </div>
      ) : (
        <div className="border border-curtn-dark overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-curtn-surface text-curtn-muted">
              <tr className="text-left">
                <th className="w-10 px-3 py-2">
                  {statusFilter === "pending" && (
                    <input
                      type="checkbox"
                      checked={allSelected}
                      ref={(el) => {
                        if (el) el.indeterminate = partiallySelected;
                      }}
                      onChange={toggleSelectAll}
                      className="cursor-pointer accent-curtn-coral"
                      aria-label="Select all"
                    />
                  )}
                </th>
                <th className="w-14 px-2 py-2"></th>
                <th className="px-3 py-2 text-xs uppercase tracking-wider">Title</th>
                <th className="px-3 py-2 text-xs uppercase tracking-wider">Venue / Date</th>
                <th className="px-3 py-2 text-xs uppercase tracking-wider">Cast</th>
                <th className="px-3 py-2 text-xs uppercase tracking-wider">Source</th>
                <th className="px-3 py-2 text-xs uppercase tracking-wider">Status</th>
                <th className="w-12 px-2 py-2"></th>
                <th className="px-3 py-2 text-right text-xs uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => {
                const busy = rowBusy[item.id];
                const error = rowError[item.id];
                const isEditing = editingId === item.id;
                const canSelect = item.status === "pending";
                const isSelected = selected.has(item.id);
                return (
                  <RowGroup
                    key={item.id}
                    item={item}
                    busy={busy}
                    error={error}
                    isEditing={isEditing}
                    canSelect={canSelect}
                    isSelected={isSelected}
                    editFields={editFields}
                    onToggle={() => toggleSelect(item.id)}
                    onCheckboxClick={(e) => handleRowCheckboxClick(e, item.id)}
                    onApprove={() => handleApprove(item)}
                    onReject={() => handleReject(item)}
                    onEdit={() => startEditing(item)}
                    onCancelEdit={() => setEditingId(null)}
                    onSaveEdit={handleSaveEdit}
                    onEditChange={(field, value) =>
                      setEditFields((f) => ({ ...f, [field]: value }))
                    }
                    formatDate={formatDate}
                    timeSince={timeSince}
                  />
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {flaggingBulk && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={() => !flagBusy && setFlaggingBulk(false)}
        >
          <div
            className="w-full max-w-md bg-curtn-surface border border-curtn-dark p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-medium text-curtn-cream">
              Flag {selected.size} selected{" "}
              {selected.size === 1 ? "event" : "events"}
            </h3>
            <p className="mb-3 text-xs text-curtn-muted">
              Logs a scraper-quality issue (does not reject). Applied to all
              selected.
            </p>
            <div className="mb-3 grid grid-cols-2 gap-1.5">
              {SCRAPER_ISSUE_CATEGORIES.map((c) => (
                <label
                  key={c.value}
                  className="flex cursor-pointer items-center gap-2 text-sm text-curtn-cream"
                >
                  <input
                    type="checkbox"
                    checked={flagCats.has(c.value)}
                    onChange={() => toggleFlagCat(c.value)}
                    className="accent-curtn-coral"
                  />
                  {c.label}
                </label>
              ))}
            </div>
            <textarea
              value={flagNote}
              onChange={(e) => setFlagNote(e.target.value)}
              placeholder="Optional note…"
              rows={3}
              className="mb-2 w-full border border-curtn-dark bg-curtn-surface-2 p-2 text-sm text-curtn-cream"
            />
            {flagMsg && <p className="mb-2 text-xs text-curtn-coral">{flagMsg}</p>}
            <div className="flex justify-end gap-2">
              <Button
                variant="tertiary"
                onClick={() => setFlaggingBulk(false)}
                disabled={flagBusy}
              >
                Cancel
              </Button>
              <Button variant="primary" onClick={submitFlag} disabled={flagBusy}>
                {flagBusy ? "Saving…" : "Log issue"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function RowGroup(props: {
  item: PendingImportNode;
  busy: RowAction | undefined;
  error: string | undefined;
  isEditing: boolean;
  canSelect: boolean;
  isSelected: boolean;
  editFields: Record<string, string>;
  onToggle: () => void;
  onCheckboxClick: (e: React.MouseEvent<HTMLInputElement>) => void;
  onApprove: () => void;
  onReject: () => void;
  onEdit: () => void;
  onCancelEdit: () => void;
  onSaveEdit: () => void;
  onEditChange: (field: string, value: string) => void;
  formatDate: (iso: string | null) => string;
  timeSince: (iso: string) => string;
}) {
  const {
    item,
    busy,
    error,
    isEditing,
    canSelect,
    isSelected,
    editFields,
    onToggle,
    onCheckboxClick,
    onApprove,
    onReject,
    onEdit,
    onCancelEdit,
    onSaveEdit,
    onEditChange,
    formatDate,
    timeSince,
  } = props;

  return (
    <>
      <tr className="border-t border-curtn-dark hover:bg-curtn-surface/30">
        <td className="px-3 py-3 align-top">
          {canSelect && (
            <input
              type="checkbox"
              checked={isSelected}
              onClick={onCheckboxClick}
              onChange={onToggle}
              className="cursor-pointer accent-curtn-coral"
              aria-label={`Select ${item.title}`}
              title="Shift-click to select a range"
            />
          )}
        </td>
        <td className="px-2 py-2 align-top">
          {item.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={item.imageUrl}
              alt=""
              className="h-12 w-12 object-cover bg-curtn-surface-2"
            />
          ) : (
            <div className="h-12 w-12 bg-curtn-surface-2 flex items-center justify-center text-curtn-muted/40 text-[10px]">
              no img
            </div>
          )}
        </td>
        <td className="px-3 py-3 align-top">
          <div className="font-medium text-curtn-cream">{item.title}</div>
          {item.runTitle && item.runTitle !== item.title && (
            <div className="text-xs text-curtn-muted/80">{item.runTitle}</div>
          )}
          {item.showDescription && (
            <div
              className="mt-1 text-xs text-curtn-muted line-clamp-2 max-w-md"
              title={item.showDescription}
            >
              {item.showDescription}
            </div>
          )}
        </td>
        <td className="px-3 py-3 align-top">
          {item.venueName && (
            <div className="text-curtn-cream">{item.venueName}</div>
          )}
          {item.stageName && (
            <div className="text-xs text-curtn-muted/70">{item.stageName}</div>
          )}
          <div className="text-xs text-curtn-muted">
            {formatDate(item.date)}
            {item.time ? ` · ${item.time}` : ""}
          </div>
        </td>
        <td className="px-3 py-3 align-top">
          {item.cast.length > 0 ? (
            <div className="flex items-center gap-1">
              <AvatarStack entries={item.cast} max={4} />
              <span className="text-xs text-curtn-muted">
                {item.cast.length}
              </span>
            </div>
          ) : (
            <span className="text-xs text-curtn-muted/40">—</span>
          )}
        </td>
        <td className="px-3 py-3 align-top text-xs text-curtn-muted">
          <div className="text-curtn-muted/80">{item.dataSource.name}</div>
          <div className="text-curtn-muted/40">{timeSince(item.importedAt)}</div>
        </td>
        <td className="px-3 py-3 align-top">
          <StatusPill status={item.status} />
        </td>
        <td className="px-2 py-3 align-top">
          {item.ticketUrl && (
            <a
              href={item.ticketUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-curtn-muted hover:text-curtn-coral text-xs"
              title={item.ticketUrl}
              aria-label="Open source page"
            >
              ↗
            </a>
          )}
        </td>
        <td className="px-3 py-3 align-top">
          {item.status === "pending" ? (
            <div className="flex justify-end gap-1.5">
              <Button
                variant="tertiary"
                onClick={onEdit}
                disabled={Boolean(busy)}
              >
                Edit
              </Button>
              <Button
                variant="tertiary"
                onClick={onReject}
                disabled={Boolean(busy)}
              >
                {busy === "reject" ? "..." : "Reject"}
              </Button>
              <Button
                variant="primary"
                onClick={onApprove}
                disabled={Boolean(busy)}
              >
                {busy === "approve" ? "..." : "Approve"}
              </Button>
            </div>
          ) : (
            <div className="text-right text-xs text-curtn-muted/40">—</div>
          )}
        </td>
      </tr>
      {error && (
        <tr className="border-t border-curtn-red/40 bg-curtn-red/5">
          <td colSpan={9} className="px-3 py-2 text-xs text-curtn-red">
            {error}
          </td>
        </tr>
      )}
      {item.error && !error && (
        <tr className="border-t border-curtn-red/40 bg-curtn-red/5">
          <td colSpan={9} className="px-3 py-2 text-xs text-curtn-red">
            Last attempt: {item.error}
          </td>
        </tr>
      )}
      {isEditing && (
        <EditDrawer
          item={item}
          fields={editFields}
          onChange={onEditChange}
          onCancel={onCancelEdit}
          onSave={onSaveEdit}
        />
      )}
    </>
  );
}

function EditDrawer({
  item,
  fields,
  onChange,
  onCancel,
  onSave,
}: {
  item: PendingImportNode;
  fields: Record<string, string>;
  onChange: (field: string, value: string) => void;
  onCancel: () => void;
  onSave: () => void;
}) {
  const fieldDefs: Array<{ key: string; label: string; type?: string }> = [
    { key: "title", label: "Show Title" },
    { key: "runTitle", label: "Run Title" },
    { key: "venueName", label: "Venue" },
    { key: "stageName", label: "Stage" },
    { key: "companyName", label: "Company" },
    { key: "date", label: "Date", type: "date" },
    { key: "time", label: "Time" },
    { key: "ticketUrl", label: "Ticket URL" },
  ];
  return (
    <tr className="border-t border-curtn-dark bg-curtn-surface/40">
      <td colSpan={9} className="px-4 py-4">
        <div className="grid gap-3 sm:grid-cols-2">
          {fieldDefs.map((f) => (
            <div key={f.key}>
              <label className="block text-[10px] uppercase tracking-wider text-curtn-muted mb-1">
                {f.label}
              </label>
              <input
                type={f.type || "text"}
                value={fields[f.key] || ""}
                onChange={(e) => onChange(f.key, e.target.value)}
                className="w-full border border-curtn-dark bg-curtn-deep px-3 py-2 text-sm text-curtn-cream focus:border-curtn-coral focus:outline-none"
              />
            </div>
          ))}
          <div className="sm:col-span-2">
            <label className="block text-[10px] uppercase tracking-wider text-curtn-muted mb-1">
              Show Description
            </label>
            <textarea
              value={fields.showDescription || ""}
              onChange={(e) => onChange("showDescription", e.target.value)}
              rows={3}
              className="w-full border border-curtn-dark bg-curtn-deep px-3 py-2 text-sm text-curtn-cream focus:border-curtn-coral focus:outline-none"
            />
          </div>
        </div>
        <div className="mt-3 flex justify-end gap-2">
          <Button variant="tertiary" onClick={onCancel}>
            Cancel
          </Button>
          <Button variant="primary" onClick={onSave}>
            Save
          </Button>
        </div>
      </td>
    </tr>
  );
}

function StatusPill({ status }: { status: string }) {
  const className =
    status === "pending"
      ? "bg-yellow-500/20 text-yellow-400"
      : status === "approved"
        ? "bg-green-500/20 text-green-400"
        : "bg-curtn-red/20 text-curtn-red";
  return (
    <span
      className={`inline-block px-2 py-0.5 text-[10px] uppercase tracking-wider ${className}`}
    >
      {status}
    </span>
  );
}

function AvatarStack({ entries, max }: { entries: CreditEntry[]; max: number }) {
  const visible = entries.slice(0, max);
  return (
    <div className="flex -space-x-1">
      {visible.map((entry, i) => (
        <div key={`${entry.name}-${i}`} className="ring-1 ring-curtn-deep">
          <Avatar name={entry.name} headshotUrl={entry.headshotUrl} />
        </div>
      ))}
    </div>
  );
}

function Avatar({
  name,
  headshotUrl,
}: {
  name: string;
  headshotUrl: string | null;
}) {
  if (headshotUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return (
      <img
        src={headshotUrl}
        alt=""
        className="h-6 w-6 rounded-full object-cover"
      />
    );
  }
  const initials = name
    .split(/\s+/)
    .map((s) => s[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
  return (
    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-curtn-dark text-[9px] font-medium text-curtn-cream">
      {initials}
    </div>
  );
}
