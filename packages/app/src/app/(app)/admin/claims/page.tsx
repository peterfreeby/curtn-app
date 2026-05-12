"use client";

import { useState } from "react";
import { useQuery, useMutation } from "urql";
import {
  CLAIM_REQUESTS_QUERY,
  APPROVE_CLAIM_REQUEST_MUTATION,
  REJECT_CLAIM_REQUEST_MUTATION,
  ADMIN_UNCLAIM_PERSON_MUTATION,
} from "@/lib/graphql/claims";
import { APPROVE_CLAIM_MUTATION, DECLINE_CLAIM_MUTATION } from "@/lib/graphql/claim";
import Link from "next/link";

// Polymorphic admin claim review queue (Phase 2).
//
// Handles both legacy Person-only ClaimRequests (with `person` field) and
// generalized polymorphic claims (with `target` field for Venue / Company /
// Person). Legacy approvals use approveClaimRequest mutation; polymorphic
// ones use approveClaim. Both fire in-app notifications.

interface TargetNode {
  kind: "venue" | "productionCompany" | "person";
  targetId: string;
  name: string | null;
  slug: string | null;
}

interface ClaimSignals {
  webmasterVerified: boolean;
  externalProfileLinks: Array<{ url: string; platform: string }>;
  trustGraphEndorsements: Array<{ grantingUnitKind: string | null }>;
  autoPromotionScore: number;
  autoPromotedAt: string | null;
}

interface ClaimRequestNode {
  id: string;
  user: { id: string; fullName: string; username: string; avatarUrl: string };
  person: { id: string; name: string; slug: string; headshotUrl: string | null; isClaimed: boolean } | null;
  target: TargetNode | null;
  status: string;
  message: string | null;
  reviewerNotes: string | null;
  requestedAt: string;
  reviewedAt: string | null;
  reviewedBy: { id: string; username: string } | null;
  signals: ClaimSignals | null;
}

type StatusFilter = "pending" | "approved" | "rejected" | "all";
type TargetFilter = "all" | "venue" | "productionCompany" | "person";

const TARGET_FILTER_LABELS: Record<TargetFilter, string> = {
  all: "All types",
  venue: "Venues",
  productionCompany: "Companies",
  person: "People",
};

const KIND_LABELS: Record<string, string> = {
  venue: "Venue",
  productionCompany: "Company",
  person: "Person",
};

const KIND_PATH_PREFIX: Record<string, string> = {
  venue: "/venues",
  productionCompany: "/companies",
  person: "/people",
};

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

function resolveTargetDisplay(item: ClaimRequestNode): { kind: string; name: string; href: string | null } {
  if (item.target?.kind && item.target.name) {
    return {
      kind: item.target.kind,
      name: item.target.name,
      href: item.target.slug ? `${KIND_PATH_PREFIX[item.target.kind]}/${item.target.slug}` : null,
    };
  }
  if (item.person) {
    return {
      kind: "person",
      name: item.person.name,
      href: `/people/${item.person.slug}`,
    };
  }
  return { kind: "unknown", name: "(unknown target)", href: null };
}

export default function AdminClaimsPage() {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("pending");
  const [targetFilter, setTargetFilter] = useState<TargetFilter>("all");
  const [message, setMessage] = useState<string | null>(null);
  const [reviewerNotesById, setReviewerNotesById] = useState<Record<string, string>>({});

  const [{ data, fetching }, reexecute] = useQuery({
    query: CLAIM_REQUESTS_QUERY,
    variables: {
      status: statusFilter === "all" ? undefined : statusFilter,
    },
  });

  // Legacy mutations — used when a claim has a `person` ref but no polymorphic `target`.
  const [{ fetching: legacyApproving }, executeLegacyApprove] = useMutation(APPROVE_CLAIM_REQUEST_MUTATION);
  const [{ fetching: legacyRejecting }, executeLegacyReject] = useMutation(REJECT_CLAIM_REQUEST_MUTATION);
  // Polymorphic mutations — used when a claim has a `target` ref.
  const [{ fetching: approving }, executeApprove] = useMutation(APPROVE_CLAIM_MUTATION);
  const [{ fetching: declining }, executeDecline] = useMutation(DECLINE_CLAIM_MUTATION);
  const [{ fetching: unclaiming }, executeUnclaim] = useMutation(ADMIN_UNCLAIM_PERSON_MUTATION);

  const allItems: ClaimRequestNode[] = data?.claimRequests?.edges?.map((e: any) => e.node) || [];
  const items = allItems.filter((item) => {
    if (targetFilter === "all") return true;
    const display = resolveTargetDisplay(item);
    return display.kind === targetFilter;
  });

  function reviewerNotesFor(id: string): string {
    return reviewerNotesById[id] ?? "";
  }
  function setReviewerNotesFor(id: string, value: string) {
    setReviewerNotesById((prev) => ({ ...prev, [id]: value }));
  }

  async function handleApprove(item: ClaimRequestNode) {
    setMessage(null);
    const notes = reviewerNotesFor(item.id);

    if (item.target?.kind) {
      const result = await executeApprove({
        input: { claimRequestId: decodeGlobalId(item.id), reviewerNotes: notes || undefined },
      });
      const payload = result.data?.approveClaim;
      if (payload?.error) {
        setMessage(payload.error);
      } else {
        reexecute({ requestPolicy: "network-only" });
      }
      return;
    }

    // Legacy path
    const result = await executeLegacyApprove({
      input: { claimRequestId: decodeGlobalId(item.id) },
    });
    if (result.data?.approveClaimRequest?.error) {
      setMessage(result.data.approveClaimRequest.error);
    } else {
      reexecute({ requestPolicy: "network-only" });
    }
  }

  async function handleDecline(item: ClaimRequestNode) {
    setMessage(null);
    const notes = reviewerNotesFor(item.id);

    if (item.target?.kind) {
      const result = await executeDecline({
        input: { claimRequestId: decodeGlobalId(item.id), reviewerNotes: notes || undefined },
      });
      const payload = result.data?.declineClaim;
      if (payload?.error) {
        setMessage(payload.error);
      } else {
        reexecute({ requestPolicy: "network-only" });
      }
      return;
    }

    // Legacy path
    const result = await executeLegacyReject({
      input: { claimRequestId: decodeGlobalId(item.id) },
    });
    if (result.data?.rejectClaimRequest?.error) {
      setMessage(result.data.rejectClaimRequest.error);
    } else {
      reexecute({ requestPolicy: "network-only" });
    }
  }

  async function handleUnclaim(item: ClaimRequestNode) {
    if (!item.person) return;
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

  function targetBadge(kind: string) {
    return (
      <span className="inline-block rounded-full bg-curtn-dark px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-curtn-muted">
        {KIND_LABELS[kind] || kind}
      </span>
    );
  }

  const busy = approving || declining || legacyApproving || legacyRejecting || unclaiming;

  return (
    <div className="px-6 py-8 max-w-4xl mx-auto space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-curtn-cream">Claim Requests</h1>
          <p className="mt-1 text-sm text-curtn-muted">
            Review requests from users to claim venues, production companies, and performer profiles.
          </p>
        </div>
        <Link
          href="/admin/claims/auto-approved"
          className="text-xs text-curtn-coral hover:underline shrink-0"
        >
          Auto-approved claims →
        </Link>
      </div>

      {message && (
        <div className="rounded-lg border border-curtn-dark bg-curtn-surface px-4 py-3 text-sm text-curtn-cream">
          {message}
        </div>
      )}

      <div className="flex flex-wrap gap-3">
        <div className="flex gap-1 rounded-lg bg-curtn-surface p-1">
          {(["pending", "approved", "rejected", "all"] as StatusFilter[]).map((s) => (
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
          ))}
        </div>

        <div className="flex gap-1 rounded-lg bg-curtn-surface p-1">
          {(["all", "venue", "productionCompany", "person"] as TargetFilter[]).map((t) => (
            <button
              key={t}
              onClick={() => setTargetFilter(t)}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer ${
                targetFilter === t
                  ? "bg-curtn-deep text-curtn-cream"
                  : "text-curtn-muted hover:text-curtn-cream"
              }`}
            >
              {TARGET_FILTER_LABELS[t]}
            </button>
          ))}
        </div>
      </div>

      {fetching && (
        <div className="flex justify-center py-8">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-curtn-muted/30 border-t-curtn-coral" />
        </div>
      )}

      {!fetching && items.length === 0 && (
        <div className="rounded-lg border border-curtn-dark bg-curtn-surface px-6 py-10 text-center">
          <p className="text-sm text-curtn-muted">
            No {statusFilter === "all" ? "" : statusFilter} claim requests
            {targetFilter !== "all" ? ` for ${TARGET_FILTER_LABELS[targetFilter].toLowerCase()}` : ""}.
          </p>
        </div>
      )}

      {!fetching && items.length > 0 && (
        <div className="space-y-3">
          {items.map((item) => {
            const display = resolveTargetDisplay(item);
            const isPolymorphic = !!item.target?.kind;
            const isLegacyPersonClaim = !isPolymorphic && !!item.person;

            return (
              <div
                key={item.id}
                className="rounded-lg border border-curtn-dark bg-curtn-surface p-4 space-y-3"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center gap-2">
                      {statusBadge(item.status)}
                      {targetBadge(display.kind)}
                      <span className="text-xs text-curtn-muted">{timeSince(item.requestedAt)}</span>
                    </div>
                    <p className="text-sm text-curtn-cream">
                      <Link href={`/u/${item.user.username}`} className="text-curtn-coral hover:underline">
                        @{item.user.username}
                      </Link>
                      {" "}wants to claim{" "}
                      {display.href ? (
                        <Link href={display.href} className="text-curtn-coral hover:underline">
                          {display.name}
                        </Link>
                      ) : (
                        <span className="text-curtn-cream">{display.name}</span>
                      )}
                    </p>
                    <p className="text-xs text-curtn-muted">{item.user.fullName}</p>
                    {item.message && (
                      <p className="text-xs text-curtn-muted/80 italic mt-1 whitespace-pre-wrap">
                        &ldquo;{item.message}&rdquo;
                      </p>
                    )}
                    {item.signals && (
                      <div className="mt-2 rounded-md border border-curtn-dark bg-curtn-deep/50 px-3 py-2 text-[11px] text-curtn-muted space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="uppercase tracking-wider text-[10px]">Signals</span>
                          <span className="text-curtn-cream font-medium">
                            {item.signals.autoPromotionScore} / 100
                          </span>
                          {item.signals.autoPromotedAt && (
                            <span className="rounded-full bg-green-500/20 px-2 py-0.5 text-[9px] uppercase tracking-wider text-green-400">
                              Auto-approved
                            </span>
                          )}
                        </div>
                        <ul className="space-y-0.5">
                          <li>
                            Webmaster:{" "}
                            <span className={item.signals.webmasterVerified ? "text-green-400" : "text-curtn-muted"}>
                              {item.signals.webmasterVerified ? "verified" : "not verified"}
                            </span>
                          </li>
                          <li>
                            External profiles: {item.signals.externalProfileLinks.length}
                            {item.signals.externalProfileLinks.length > 0 && (
                              <span className="ml-1 text-curtn-muted/70">
                                ({item.signals.externalProfileLinks.map((l) => l.platform).join(", ")})
                              </span>
                            )}
                          </li>
                          <li>Trust graph: {item.signals.trustGraphEndorsements.length} endorsement(s)</li>
                        </ul>
                      </div>
                    )}
                    {item.reviewerNotes && item.status !== "pending" && (
                      <p className="text-[11px] text-curtn-muted/80 mt-1">
                        <span className="uppercase tracking-wider text-[10px]">Reviewer notes:</span> {item.reviewerNotes}
                      </p>
                    )}
                    {item.reviewedBy && item.reviewedAt && (
                      <p className="text-[10px] text-curtn-muted/60 mt-1">
                        Reviewed by @{item.reviewedBy.username} &middot; {timeSince(item.reviewedAt)}
                      </p>
                    )}
                  </div>

                  <div className="flex gap-2 shrink-0">
                    {item.status === "approved" && isLegacyPersonClaim && item.person?.isClaimed && (
                      <button
                        onClick={() => handleUnclaim(item)}
                        disabled={busy}
                        className="rounded-md bg-curtn-dark px-3 py-1.5 text-xs font-medium text-curtn-muted hover:text-curtn-cream transition-colors cursor-pointer disabled:opacity-50"
                      >
                        Unclaim
                      </button>
                    )}
                  </div>
                </div>

                {item.status === "pending" && (
                  <div className="space-y-2 border-t border-curtn-dark pt-3">
                    {isPolymorphic && (
                      <textarea
                        value={reviewerNotesFor(item.id)}
                        onChange={(e) => setReviewerNotesFor(item.id, e.target.value)}
                        placeholder="Optional reviewer notes (visible to claimant on decline; logged on approve)"
                        rows={2}
                        className="w-full rounded-md border border-curtn-dark bg-curtn-deep px-3 py-2 text-xs text-curtn-cream placeholder:text-curtn-muted/60 focus:border-curtn-coral focus:outline-none"
                      />
                    )}
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleApprove(item)}
                        disabled={busy}
                        className="rounded-md bg-green-500/20 px-3 py-1.5 text-xs font-medium text-green-400 hover:bg-green-500/30 transition-colors cursor-pointer disabled:opacity-50"
                      >
                        Approve
                      </button>
                      <button
                        onClick={() => handleDecline(item)}
                        disabled={busy}
                        className="rounded-md bg-red-500/20 px-3 py-1.5 text-xs font-medium text-red-400 hover:bg-red-500/30 transition-colors cursor-pointer disabled:opacity-50"
                      >
                        Decline
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
