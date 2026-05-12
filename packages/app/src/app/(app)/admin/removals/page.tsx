"use client";

import { useState } from "react";
import { useQuery, useMutation } from "urql";
import Link from "next/link";
import {
  PENDING_REMOVAL_REQUESTS_QUERY,
  PROCESS_REMOVAL_REQUEST_MUTATION,
} from "@/lib/graphql/auditLog";

// Admin queue for RemovalRequests. Approve flips the targeted AuditLog row's
// hidden* fields; decline records the decision. Both responses persist a
// reviewer note when supplied.

interface RemovalRequestNode {
  id: string;
  targetAuditLogId: string;
  reason: string;
  category: string;
  status: string;
  reviewerNotes: string | null;
  reviewedAt: string | null;
  createdAt: string;
  requester: { id: string; username: string; fullName: string; avatarUrl: string } | null;
}

type StatusFilter = "pending" | "approved" | "declined";

function timeSince(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const hours = Math.floor(diff / (1000 * 60 * 60));
  if (hours < 1) return "just now";
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default function AdminRemovalsPage() {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("pending");
  const [notesById, setNotesById] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | null>(null);

  const [{ data, fetching, error }, refetch] = useQuery({
    query: PENDING_REMOVAL_REQUESTS_QUERY,
    variables: { first: 50, status: statusFilter },
  });

  const [, process] = useMutation(PROCESS_REMOVAL_REQUEST_MUTATION);

  async function handleProcess(id: string, approve: boolean) {
    const reviewerNotes = notesById[id]?.trim();
    const result = await process({
      input: {
        removalRequestId: id,
        approve,
        ...(reviewerNotes ? { reviewerNotes } : {}),
      },
    });
    if (result.data?.processRemovalRequest?.error) {
      setMessage(result.data.processRemovalRequest.error);
      return;
    }
    setMessage(approve ? "Approved and hidden." : "Declined.");
    setNotesById(prev => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    refetch({ requestPolicy: "network-only" });
  }

  const edges = data?.pendingRemovalRequests?.edges || [];

  return (
    <div className="px-2 sm:px-6 py-8 max-w-[var(--content-width)] mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-medium text-curtn-cream">Removal requests</h1>
        <Link href="/admin/claims" className="text-xs text-curtn-muted hover:text-curtn-cream">
          Claim queue →
        </Link>
      </div>

      <div className="flex gap-2 text-xs">
        {(["pending", "approved", "declined"] as StatusFilter[]).map(s => (
          <button
            key={s}
            type="button"
            onClick={() => setStatusFilter(s)}
            className={`px-3 py-1 rounded-full transition ${
              statusFilter === s
                ? "bg-curtn-cream text-curtn-deep"
                : "bg-curtn-surface text-curtn-muted hover:text-curtn-cream"
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      {message && (
        <div className="rounded bg-curtn-surface px-4 py-2 text-sm text-curtn-cream">{message}</div>
      )}

      {fetching && <p className="text-sm text-curtn-muted">Loading…</p>}
      {error && <p className="text-sm text-curtn-coral">Failed to load requests.</p>}
      {!fetching && edges.length === 0 && (
        <p className="text-sm text-curtn-muted">No {statusFilter} requests.</p>
      )}

      <div className="space-y-3">
        {edges.map(({ node }: { node: RemovalRequestNode }) => (
          <div key={node.id} className="rounded-lg border border-curtn-dark bg-curtn-surface/40 p-4 space-y-3">
            <div className="flex items-center justify-between gap-2 text-xs">
              <div className="text-curtn-cream">
                <span className="font-medium">
                  {node.requester?.username ? `@${node.requester.username}` : "Someone"}
                </span>
                <span className="ml-2 inline-block rounded bg-curtn-dark px-1.5 py-0.5 text-[10px] uppercase">
                  {node.category}
                </span>
              </div>
              <span className="text-curtn-muted">{timeSince(node.createdAt)}</span>
            </div>

            <p className="text-sm text-curtn-cream/90">{node.reason}</p>

            <p className="text-[11px] text-curtn-muted font-mono break-all">
              Target audit log id: {node.targetAuditLogId}
            </p>

            {node.status === "pending" && (
              <>
                <textarea
                  value={notesById[node.id] || ""}
                  onChange={e => setNotesById(prev => ({ ...prev, [node.id]: e.target.value }))}
                  placeholder="Reviewer notes (optional)"
                  className="w-full bg-curtn-dark text-curtn-cream text-xs rounded px-2 py-1.5 min-h-[60px]"
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => handleProcess(node.id, true)}
                    className="text-xs px-3 py-1.5 rounded bg-curtn-coral text-curtn-deep hover:bg-curtn-coral/80"
                  >
                    Approve and hide
                  </button>
                  <button
                    type="button"
                    onClick={() => handleProcess(node.id, false)}
                    className="text-xs px-3 py-1.5 rounded border border-curtn-dark text-curtn-cream hover:bg-curtn-surface"
                  >
                    Decline
                  </button>
                </div>
              </>
            )}

            {node.status !== "pending" && node.reviewerNotes && (
              <p className="text-xs text-curtn-muted">Notes: {node.reviewerNotes}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
