"use client";

import { useState } from "react";
import { useQuery, useMutation } from "urql";
import {
  CLAIM_REQUESTS_QUERY,
  APPROVE_CLAIM_REQUEST_MUTATION,
  REJECT_CLAIM_REQUEST_MUTATION,
  ADMIN_UNCLAIM_PERSON_MUTATION,
} from "@/lib/graphql/claims";
import Link from "next/link";

interface ClaimRequestNode {
  id: string;
  user: { id: string; fullName: string; username: string; avatarUrl: string };
  person: { id: string; name: string; slug: string; headshotUrl: string | null; isClaimed: boolean };
  status: string;
  message: string | null;
  requestedAt: string;
  reviewedAt: string | null;
  reviewedBy: { id: string; username: string } | null;
}

type StatusFilter = "pending" | "approved" | "rejected" | "all";

function decodeGlobalId(globalId: string): string {
  const decoded = atob(globalId);
  return decoded.split(":")[1];
}

function timeSince(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const hours = Math.floor(diff / (1000 * 60 * 60));
  if (hours < 1) return "just now";
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default function AdminClaimsPage() {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("pending");
  const [message, setMessage] = useState<string | null>(null);

  const [{ data, fetching }, reexecute] = useQuery({
    query: CLAIM_REQUESTS_QUERY,
    variables: {
      status: statusFilter === "all" ? undefined : statusFilter,
    },
  });

  const [{ fetching: approving }, executeApprove] = useMutation(APPROVE_CLAIM_REQUEST_MUTATION);
  const [{ fetching: rejecting }, executeReject] = useMutation(REJECT_CLAIM_REQUEST_MUTATION);
  const [{ fetching: unclaiming }, executeUnclaim] = useMutation(ADMIN_UNCLAIM_PERSON_MUTATION);

  const items: ClaimRequestNode[] =
    data?.claimRequests?.edges?.map((e: any) => e.node) || [];

  async function handleApprove(item: ClaimRequestNode) {
    setMessage(null);
    const result = await executeApprove({
      input: { claimRequestId: decodeGlobalId(item.id) },
    });
    if (result.data?.approveClaimRequest?.error) {
      setMessage(result.data.approveClaimRequest.error);
    } else {
      reexecute({ requestPolicy: "network-only" });
    }
  }

  async function handleReject(item: ClaimRequestNode) {
    setMessage(null);
    const result = await executeReject({
      input: { claimRequestId: decodeGlobalId(item.id) },
    });
    if (result.data?.rejectClaimRequest?.error) {
      setMessage(result.data.rejectClaimRequest.error);
    } else {
      reexecute({ requestPolicy: "network-only" });
    }
  }

  async function handleUnclaim(item: ClaimRequestNode) {
    setMessage(null);
    const result = await executeUnclaim({
      input: { personId: decodeGlobalId(item.person.id) },
    });
    if (result.data?.adminUnclaimPerson?.error) {
      setMessage(result.data.adminUnclaimPerson.error);
    } else {
      setMessage(`Unclaimed ${item.person.name} from @${item.user.username}`);
      reexecute({ requestPolicy: "network-only" });
    }
  }

  function statusBadge(status: string) {
    const colors: Record<string, string> = {
      pending: "bg-yellow-500/20 text-yellow-400",
      approved: "bg-green-500/20 text-green-400",
      rejected: "bg-red-500/20 text-red-400",
    };
    return (
      <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider ${colors[status] || "text-curtn-muted"}`}>
        {status}
      </span>
    );
  }

  return (
    <div className="px-6 py-8 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-bold text-curtn-cream">Claim Requests</h1>
        <p className="mt-1 text-sm text-curtn-muted">
          Review requests from users to link their account to a performer/creator profile.
        </p>
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
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer ${
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

      {fetching && (
        <div className="flex justify-center py-8">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-curtn-muted/30 border-t-curtn-coral" />
        </div>
      )}

      {!fetching && items.length === 0 && (
        <div className="rounded-lg border border-curtn-dark bg-curtn-surface px-6 py-10 text-center">
          <p className="text-sm text-curtn-muted">No {statusFilter === "all" ? "" : statusFilter} claim requests.</p>
        </div>
      )}

      {!fetching && items.length > 0 && (
        <div className="space-y-3">
          {items.map((item) => (
            <div
              key={item.id}
              className="rounded-lg border border-curtn-dark bg-curtn-surface p-4 space-y-3"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center gap-2">
                    {statusBadge(item.status)}
                    <span className="text-xs text-curtn-muted">{timeSince(item.requestedAt)}</span>
                  </div>
                  <p className="text-sm text-curtn-cream">
                    <Link href={`/u/${item.user.username}`} className="text-curtn-coral hover:underline">
                      @{item.user.username}
                    </Link>
                    {" "}wants to claim{" "}
                    <Link href={`/people/${item.person.slug}`} className="text-curtn-coral hover:underline">
                      {item.person.name}
                    </Link>
                  </p>
                  <p className="text-xs text-curtn-muted">
                    {item.user.fullName}
                  </p>
                  {item.message && (
                    <p className="text-xs text-curtn-muted/80 italic mt-1">
                      &ldquo;{item.message}&rdquo;
                    </p>
                  )}
                  {item.reviewedBy && item.reviewedAt && (
                    <p className="text-[10px] text-curtn-muted/60 mt-1">
                      Reviewed by @{item.reviewedBy.username} &middot; {timeSince(item.reviewedAt)}
                    </p>
                  )}
                </div>

                {/* Actions */}
                <div className="flex gap-2 shrink-0">
                  {item.status === "pending" && (
                    <>
                      <button
                        onClick={() => handleApprove(item)}
                        disabled={approving}
                        className="rounded-md bg-green-500/20 px-3 py-1.5 text-xs font-medium text-green-400 hover:bg-green-500/30 transition-colors cursor-pointer disabled:opacity-50"
                      >
                        Approve
                      </button>
                      <button
                        onClick={() => handleReject(item)}
                        disabled={rejecting}
                        className="rounded-md bg-red-500/20 px-3 py-1.5 text-xs font-medium text-red-400 hover:bg-red-500/30 transition-colors cursor-pointer disabled:opacity-50"
                      >
                        Reject
                      </button>
                    </>
                  )}
                  {item.status === "approved" && item.person.isClaimed && (
                    <button
                      onClick={() => handleUnclaim(item)}
                      disabled={unclaiming}
                      className="rounded-md bg-curtn-dark px-3 py-1.5 text-xs font-medium text-curtn-muted hover:text-curtn-cream transition-colors cursor-pointer disabled:opacity-50"
                    >
                      Unclaim
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
