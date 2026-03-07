"use client";

import { useState } from "react";
import { useQuery, useMutation } from "urql";
import {
  PENDING_IMPORTS_QUERY,
  APPROVE_PENDING_IMPORT_MUTATION,
  REJECT_PENDING_IMPORT_MUTATION,
  EDIT_PENDING_IMPORT_MUTATION,
  AUTO_VALIDATE_MUTATION,
} from "@/lib/graphql/admin";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";

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
  importedAt: string;
  reviewedAt: string | null;
  error: string | null;
  dataSource: { id: string; name: string };
}

type StatusFilter = "pending" | "approved" | "rejected" | "all";

export default function IncomingEventsPage() {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("pending");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editFields, setEditFields] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | null>(null);

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

  const items: PendingImportNode[] =
    data?.pendingImports?.edges?.map((e: any) => e.node) || [];

  function decodeGlobalId(globalId: string): string {
    const decoded = atob(globalId);
    return decoded.split(":")[1];
  }

  async function handleApprove(item: PendingImportNode) {
    setMessage(null);
    const result = await executeApprove({
      input: { pendingImportId: decodeGlobalId(item.id) },
    });
    if (result.data?.approvePendingImport?.error) {
      setMessage(result.data.approvePendingImport.error);
    } else {
      reexecuteQuery({ requestPolicy: "network-only" });
    }
  }

  async function handleReject(item: PendingImportNode) {
    setMessage(null);
    const result = await executeReject({
      input: { pendingImportId: decodeGlobalId(item.id) },
    });
    if (result.data?.rejectPendingImport?.error) {
      setMessage(result.data.rejectPendingImport.error);
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
    setMessage(null);
    const result = await executeEdit({
      input: {
        pendingImportId: decodeGlobalId(editingId),
        ...editFields,
        date: editFields.date ? new Date(editFields.date).toISOString() : undefined,
      },
    });
    if (result.data?.editPendingImport?.error) {
      setMessage(result.data.editPendingImport.error);
    } else {
      setEditingId(null);
      reexecuteQuery({ requestPolicy: "network-only" });
    }
  }

  async function handleAutoValidate() {
    setMessage(null);
    const result = await executeAutoValidate({ input: {} });
    const d = result.data?.autoValidatePendingImports;
    if (d?.error) {
      setMessage(d.error);
    } else if (d) {
      setMessage(
        `Auto-validated: ${d.approvedCount} approved, ${d.errorCount} errors`
      );
      reexecuteQuery({ requestPolicy: "network-only" });
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

  function timeSince(iso: string): string {
    const diff = Date.now() - new Date(iso).getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    if (hours < 1) return "just now";
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  }

  return (
    <div className="px-6 py-8 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-curtn-cream">
            Incoming Events
          </h1>
          <p className="mt-1 text-sm text-curtn-muted">
            Review events imported from feeds. Items older than 1 day
            auto-approve.
          </p>
        </div>
        <Button
          variant="secondary"
          onClick={handleAutoValidate}
          disabled={validating}
        >
          {validating ? "Validating..." : "Auto-Validate"}
        </Button>
      </div>

      {message && (
        <div className="rounded-lg border border-curtn-dark bg-curtn-surface px-4 py-3 text-sm text-curtn-cream">
          {message}
        </div>
      )}

      {/* Status filter tabs */}
      <div className="flex gap-1 rounded-lg bg-curtn-surface p-1">
        {(["pending", "approved", "rejected", "all"] as StatusFilter[]).map(
          (s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                statusFilter === s
                  ? "bg-curtn-deep text-curtn-cream"
                  : "text-curtn-muted hover:text-curtn-cream"
              }`}
            >
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          )
        )}
      </div>

      {/* Items */}
      {fetching && !data ? (
        <p className="text-sm text-curtn-muted">Loading...</p>
      ) : items.length === 0 ? (
        <Card>
          <p className="text-sm text-curtn-muted text-center py-8">
            {statusFilter === "pending"
              ? "No pending events. Poll a data source to import new events."
              : "No events match this filter."}
          </p>
        </Card>
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <Card key={item.id} className="space-y-3">
              {editingId === item.id ? (
                /* Edit mode */
                <div className="space-y-3">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <label className="block text-xs text-curtn-muted mb-1">
                        Show Title
                      </label>
                      <input
                        value={editFields.title}
                        onChange={(e) =>
                          setEditFields((f) => ({
                            ...f,
                            title: e.target.value,
                          }))
                        }
                        className="w-full rounded-lg border border-curtn-dark bg-curtn-deep px-3 py-2 text-sm text-curtn-cream focus:border-curtn-coral focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-curtn-muted mb-1">
                        Run Title
                      </label>
                      <input
                        value={editFields.runTitle}
                        onChange={(e) =>
                          setEditFields((f) => ({
                            ...f,
                            runTitle: e.target.value,
                          }))
                        }
                        className="w-full rounded-lg border border-curtn-dark bg-curtn-deep px-3 py-2 text-sm text-curtn-cream focus:border-curtn-coral focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-curtn-muted mb-1">
                        Venue
                      </label>
                      <input
                        value={editFields.venueName}
                        onChange={(e) =>
                          setEditFields((f) => ({
                            ...f,
                            venueName: e.target.value,
                          }))
                        }
                        className="w-full rounded-lg border border-curtn-dark bg-curtn-deep px-3 py-2 text-sm text-curtn-cream focus:border-curtn-coral focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-curtn-muted mb-1">
                        Stage
                      </label>
                      <input
                        value={editFields.stageName}
                        onChange={(e) =>
                          setEditFields((f) => ({
                            ...f,
                            stageName: e.target.value,
                          }))
                        }
                        className="w-full rounded-lg border border-curtn-dark bg-curtn-deep px-3 py-2 text-sm text-curtn-cream focus:border-curtn-coral focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-curtn-muted mb-1">
                        Company
                      </label>
                      <input
                        value={editFields.companyName}
                        onChange={(e) =>
                          setEditFields((f) => ({
                            ...f,
                            companyName: e.target.value,
                          }))
                        }
                        className="w-full rounded-lg border border-curtn-dark bg-curtn-deep px-3 py-2 text-sm text-curtn-cream focus:border-curtn-coral focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-curtn-muted mb-1">
                        Date
                      </label>
                      <input
                        type="date"
                        value={editFields.date}
                        onChange={(e) =>
                          setEditFields((f) => ({
                            ...f,
                            date: e.target.value,
                          }))
                        }
                        className="w-full rounded-lg border border-curtn-dark bg-curtn-deep px-3 py-2 text-sm text-curtn-cream focus:border-curtn-coral focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-curtn-muted mb-1">
                        Time
                      </label>
                      <input
                        value={editFields.time}
                        onChange={(e) =>
                          setEditFields((f) => ({
                            ...f,
                            time: e.target.value,
                          }))
                        }
                        className="w-full rounded-lg border border-curtn-dark bg-curtn-deep px-3 py-2 text-sm text-curtn-cream focus:border-curtn-coral focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-curtn-muted mb-1">
                        Ticket URL
                      </label>
                      <input
                        value={editFields.ticketUrl}
                        onChange={(e) =>
                          setEditFields((f) => ({
                            ...f,
                            ticketUrl: e.target.value,
                          }))
                        }
                        className="w-full rounded-lg border border-curtn-dark bg-curtn-deep px-3 py-2 text-sm text-curtn-cream focus:border-curtn-coral focus:outline-none"
                      />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="primary" onClick={handleSaveEdit}>
                      Save
                    </Button>
                    <Button
                      variant="ghost"
                      onClick={() => setEditingId(null)}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                /* View mode */
                <>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-medium text-curtn-cream truncate">
                          {item.title}
                        </h3>
                        <span
                          className={`shrink-0 rounded-full px-2 py-0.5 text-xs ${
                            item.status === "pending"
                              ? "bg-yellow-500/20 text-yellow-400"
                              : item.status === "approved"
                                ? "bg-green-500/20 text-green-400"
                                : "bg-curtn-red/20 text-curtn-red"
                          }`}
                        >
                          {item.status}
                        </span>
                      </div>
                      <div className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-curtn-muted">
                        {item.venueName && <span>{item.venueName}</span>}
                        {item.stageName && (
                          <span className="text-curtn-muted/60">
                            {item.stageName}
                          </span>
                        )}
                        {item.companyName && <span>{item.companyName}</span>}
                        {item.date && (
                          <span>
                            {formatDate(item.date)}
                            {item.time ? ` ${item.time}` : ""}
                          </span>
                        )}
                      </div>
                      <div className="mt-1 flex gap-x-3 text-xs text-curtn-muted/40">
                        <span>via {item.dataSource.name}</span>
                        <span>{timeSince(item.importedAt)}</span>
                      </div>
                      {item.error && (
                        <p className="mt-1 text-xs text-curtn-red">
                          {item.error}
                        </p>
                      )}
                    </div>

                    {item.status === "pending" && (
                      <div className="flex shrink-0 gap-1.5">
                        <Button
                          variant="ghost"
                          onClick={() => startEditing(item)}
                        >
                          Edit
                        </Button>
                        <Button
                          variant="ghost"
                          onClick={() => handleReject(item)}
                        >
                          Reject
                        </Button>
                        <Button
                          variant="primary"
                          onClick={() => handleApprove(item)}
                        >
                          Approve
                        </Button>
                      </div>
                    )}
                  </div>
                </>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
