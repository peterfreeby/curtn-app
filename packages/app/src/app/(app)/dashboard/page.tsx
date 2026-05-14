"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useQuery, useMutation } from "urql";
import {
  MY_CLAIMS_QUERY,
  MY_CLAIM_REQUESTS_QUERY,
  MY_PENDING_TRANSFERS_QUERY,
  MY_PENDING_PROPOSALS_QUERY,
  INITIATE_TRANSFER_MUTATION,
  RESPOND_TO_TRANSFER_MUTATION,
  PING_DASHBOARD_ACTIVITY_MUTATION,
} from "@/lib/graphql/dashboard";
import {
  MY_CLAIMANT_SYNCS_QUERY,
  DISCONNECT_CLAIMANT_SYNC_MUTATION,
} from "@/lib/graphql/sync";
import { useAuth } from "@/lib/auth/useAuth";
import { ProposalCard, ProposalCardData } from "@/components/proposals/ProposalCard";
import { ConnectSyncSourceModal } from "@/components/sync/ConnectSyncSourceModal";

// Claimant dashboard (Phase 2). Shows pending transfer requests, units I steward,
// and a history of my claim requests.

interface MyClaim {
  kind: "venue" | "productionCompany" | "person";
  targetId: string;
  name: string;
  slug: string;
  claimState: string;
  claimedAt: string | null;
  syncHealth: string | null;
}

interface MyClaimRequest {
  id: string;
  status: string;
  message: string | null;
  reviewerNotes: string | null;
  requestedAt: string;
  reviewedAt: string | null;
  target: { kind: string; targetId: string; name: string | null; slug: string | null } | null;
  person: { id: string; name: string; slug: string } | null;
}

interface MyPendingTransfer {
  id: string;
  status: string;
  message: string | null;
  expiresAt: string;
  createdAt: string;
  fromUser: { id: string; username: string; fullName: string };
  target: { kind: string; targetId: string; name: string | null; slug: string | null };
}

const KIND_LABELS: Record<string, string> = {
  venue: "Venue",
  productionCompany: "Company",
  person: "Profile",
};

const KIND_PATH_PREFIX: Record<string, string> = {
  venue: "/venues",
  productionCompany: "/companies",
  person: "/people",
};

const STATE_LABELS: Record<string, { label: string; color: string }> = {
  "claimed-passive": { label: "Active", color: "bg-green-500/20 text-green-400" },
  "claimed-synced": { label: "Synced", color: "bg-blue-500/20 text-blue-400" },
  "provisionally-claimed": { label: "Pending", color: "bg-yellow-500/20 text-yellow-400" },
  unclaimed: { label: "Released", color: "bg-curtn-dark text-curtn-muted" },
};

const REQUEST_STATUS_LABELS: Record<string, { label: string; color: string }> = {
  pending: { label: "Pending review", color: "bg-yellow-500/20 text-yellow-400" },
  approved: { label: "Approved", color: "bg-green-500/20 text-green-400" },
  rejected: { label: "Declined", color: "bg-red-500/20 text-red-400" },
};

function decodeId(globalId: string): string {
  return atob(globalId).split(":")[1];
}

// Same as decodeId; named to make the intent obvious where it's used for
// conflict-set membership checks against raw ObjectId strings.
function decodeIdRaw(globalId: string): string {
  try { return atob(globalId).split(":")[1]; } catch { return globalId; }
}

function timeSince(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const hours = Math.floor(diff / (1000 * 60 * 60));
  if (hours < 1) return "just now";
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}

function daysUntil(iso: string): number {
  const diff = new Date(iso).getTime() - Date.now();
  return Math.max(0, Math.floor(diff / (1000 * 60 * 60 * 24)));
}

function resolveTarget(req: MyClaimRequest) {
  if (req.target?.kind && req.target.name) return { kind: req.target.kind, name: req.target.name, slug: req.target.slug };
  if (req.person) return { kind: "person", name: req.person.name, slug: req.person.slug };
  return null;
}

interface ClaimantSync {
  id: string;
  name: string;
  type: string;
  purpose: string;
  url: string | null;
  isActive: boolean;
  lastPolledAt: string | null;
  lastSuccessAt: string | null;
  healthStatus: string | null;
  associatedVenue: string | null;
  createdAt: string;
}

export default function DashboardPage() {
  const { user } = useAuth();
  const [transferFormFor, setTransferFormFor] = useState<MyClaim | null>(null);
  const [transferRecipient, setTransferRecipient] = useState("");
  const [transferMessage, setTransferMessage] = useState("");
  const [transferError, setTransferError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [syncModalFor, setSyncModalFor] = useState<MyClaim | null>(null);

  const [{ data: claimsData, fetching: claimsFetching }, refetchClaims] = useQuery({
    query: MY_CLAIMS_QUERY,
    pause: !user,
  });
  const [{ data: requestsData, fetching: requestsFetching }] = useQuery({
    query: MY_CLAIM_REQUESTS_QUERY,
    pause: !user,
  });
  const [{ data: transfersData, fetching: transfersFetching }, refetchTransfers] = useQuery({
    query: MY_PENDING_TRANSFERS_QUERY,
    pause: !user,
  });

  // Phase 4 — proposal queue. Polled every 30 seconds while the page is focused.
  const [{ data: proposalsData, fetching: proposalsFetching }, refetchProposals] = useQuery({
    query: MY_PENDING_PROPOSALS_QUERY,
    pause: !user,
    requestPolicy: "cache-and-network",
  });

  useEffect(() => {
    if (!user) return;
    let mounted = true;
    const interval = setInterval(() => {
      if (!mounted) return;
      if (typeof document !== "undefined" && document.visibilityState !== "visible") return;
      refetchProposals({ requestPolicy: "network-only" });
    }, 30_000);
    return () => { mounted = false; clearInterval(interval); };
  }, [user?.id, refetchProposals]);

  const [{ fetching: initiatingTransfer }, executeInitiate] = useMutation(INITIATE_TRANSFER_MUTATION);
  const [{ fetching: respondingTransfer }, executeRespond] = useMutation(RESPOND_TO_TRANSFER_MUTATION);
  const [, executePing] = useMutation(PING_DASHBOARD_ACTIVITY_MUTATION);
  const [{ data: syncsData }, refetchSyncs] = useQuery({
    query: MY_CLAIMANT_SYNCS_QUERY,
    pause: !user,
  });
  const [, executeDisconnectSync] = useMutation(DISCONNECT_CLAIMANT_SYNC_MUTATION);

  // Bump activity timestamp on all my claimed units when the dashboard mounts —
  // this is the "dashboard login" signal for the auto-expire cron (Task 17).
  useEffect(() => {
    if (user) {
      executePing({ input: {} });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  if (!user) {
    return (
      <div className="px-6 py-12 max-w-2xl mx-auto">
        <h1 className="text-xl font-bold text-curtn-cream">Sign in to see your dashboard</h1>
        <Link href="/login" className="mt-4 inline-block text-sm text-curtn-coral hover:underline">
          Sign in →
        </Link>
      </div>
    );
  }

  // Defensive: a server-side NonNull violation on any sub-field of a list item
  // causes GraphQL to null the entire item. Filter those out before reading
  // `.status` etc. — otherwise the page crashes. Log to console so we can
  // identify which list contains nulls and chase the root cause.
  const rawClaims: any[] = claimsData?.myClaims ?? [];
  const rawRequests: any[] = requestsData?.myClaimRequests ?? [];
  const rawTransfers: any[] = transfersData?.myPendingTransfers ?? [];
  const rawProposals: any[] = proposalsData?.myPendingProposals ?? [];
  const rawSyncs: any[] = syncsData?.myClaimantSyncs ?? [];

  const claims: MyClaim[] = rawClaims.filter((c): c is MyClaim => c != null);
  const requests: MyClaimRequest[] = rawRequests.filter((r): r is MyClaimRequest => r != null);
  const pendingTransfers: MyPendingTransfer[] = rawTransfers.filter((t): t is MyPendingTransfer => t != null);
  const pendingProposals: ProposalCardData[] = rawProposals.filter((p): p is ProposalCardData => p != null);
  const claimantSyncs: ClaimantSync[] = rawSyncs.filter((s): s is ClaimantSync => s != null);

  if (typeof window !== "undefined") {
    const droppedCounts = {
      claims: rawClaims.length - claims.length,
      requests: rawRequests.length - requests.length,
      transfers: rawTransfers.length - pendingTransfers.length,
      proposals: rawProposals.length - pendingProposals.length,
      syncs: rawSyncs.length - claimantSyncs.length,
    };
    const dropped = Object.entries(droppedCounts).filter(([, n]) => n > 0);
    if (dropped.length > 0) {
      // eslint-disable-next-line no-console
      console.warn("[dashboard] dropped null items from list responses:", Object.fromEntries(dropped));
    }
  }

  const pendingRequests = requests.filter((r) => r.status === "pending");
  const resolvedRequests = requests.filter((r) => r.status !== "pending");

  // Map venue ID → active claimant-sync row, so we can render sync controls next to each claim.
  const syncByVenueId = new Map<string, ClaimantSync>();
  for (const s of claimantSyncs) {
    if (s.associatedVenue && s.isActive) syncByVenueId.set(s.associatedVenue, s);
  }

  async function handleDisconnectSync(syncId: string) {
    const result = await executeDisconnectSync({ input: { dataSourceId: decodeId(syncId) } });
    if (result.data?.disconnectClaimantSync?.error) {
      setStatusMessage(result.data.disconnectClaimantSync.error);
      return;
    }
    setStatusMessage("Sync disconnected. Unit is back to passive.");
    refetchSyncs({ requestPolicy: "network-only" });
    refetchClaims({ requestPolicy: "network-only" });
  }

  // Group conflicting proposals together at the top of the queue.
  const conflictedIds = new Set(
    pendingProposals.flatMap((p) => p.conflictsWithProposalIds ?? [])
  );
  const conflicting = pendingProposals.filter((p) =>
    conflictedIds.has(decodeIdRaw(p.id)) || (p.conflictsWithProposalIds ?? []).length > 0
  );
  const nonConflicting = pendingProposals.filter((p) => !conflicting.includes(p));

  const loading = claimsFetching || requestsFetching || transfersFetching;

  async function handleInitiateTransfer() {
    if (!transferFormFor) return;
    setTransferError(null);

    if (transferRecipient.trim().length === 0) {
      setTransferError("Enter the recipient's username.");
      return;
    }

    const result = await executeInitiate({
      input: {
        targetKind: transferFormFor.kind,
        targetId: transferFormFor.targetId,
        toUsername: transferRecipient.trim().replace(/^@/, ""),
        message: transferMessage.trim() || undefined,
      },
    });

    const payload = result.data?.initiateTransfer;
    if (payload?.error) {
      setTransferError(payload.error);
      return;
    }
    if (result.error) {
      setTransferError(result.error.message);
      return;
    }

    setStatusMessage(`Transfer sent to @${transferRecipient.trim().replace(/^@/, "")}. They have 14 days to respond.`);
    setTransferFormFor(null);
    setTransferRecipient("");
    setTransferMessage("");
  }

  async function handleRespond(transferId: string, accept: boolean) {
    setStatusMessage(null);
    const result = await executeRespond({
      input: { transferId: decodeId(transferId), accept },
    });
    const payload = result.data?.respondToTransfer;
    if (payload?.error) {
      setStatusMessage(payload.error);
      return;
    }
    setStatusMessage(accept ? "Transfer accepted." : "Transfer declined.");
    refetchTransfers({ requestPolicy: "network-only" });
    refetchClaims({ requestPolicy: "network-only" });
  }

  return (
    <div className="px-2 sm:px-6 py-8 max-w-3xl mx-auto space-y-10">
      <div>
        <h1 className="text-xl font-bold text-curtn-cream">Your dashboard</h1>
        <p className="mt-1 text-sm text-curtn-muted">
          Units you steward and claims awaiting review.
        </p>
        <Link
          href="/dashboard/trust"
          className="mt-2 inline-block text-xs text-curtn-coral hover:underline"
        >
          Trusted editors →
        </Link>
      </div>

      {statusMessage && (
        <div className="rounded-lg border border-curtn-dark bg-curtn-surface px-4 py-3 text-sm text-curtn-cream">
          {statusMessage}
        </div>
      )}

      {loading && (
        <div className="flex justify-center py-8">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-curtn-muted/30 border-t-curtn-coral" />
        </div>
      )}

      {/* Pending edits (Phase 4) */}
      {!loading && pendingProposals.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-xs uppercase tracking-widest text-curtn-coral">Pending edits</h2>
          {conflicting.length > 0 && (
            <div className="space-y-3">
              <p className="text-[11px] uppercase tracking-widest text-yellow-300/80">Conflicts — pick one</p>
              {conflicting.map((p) => (
                <ProposalCard
                  key={p.id}
                  proposal={p}
                  highlightConflict
                  onActionDone={() => refetchProposals({ requestPolicy: "network-only" })}
                />
              ))}
            </div>
          )}
          {nonConflicting.length > 0 && (
            <div className="space-y-3">
              {nonConflicting.map((p) => (
                <ProposalCard
                  key={p.id}
                  proposal={p}
                  onActionDone={() => refetchProposals({ requestPolicy: "network-only" })}
                />
              ))}
            </div>
          )}
        </section>
      )}

      {/* Pending received transfers */}
      {!loading && pendingTransfers.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-xs uppercase tracking-widest text-curtn-coral">Transfer requests</h2>
          <div className="space-y-3">
            {pendingTransfers.map((t) => (
              <div key={t.id} className="rounded-lg border border-curtn-coral/30 bg-curtn-surface p-4 space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs text-curtn-muted">
                    {t.target.kind && KIND_LABELS[t.target.kind]} · expires in {daysUntil(t.expiresAt)}d
                  </span>
                </div>
                <p className="text-sm text-curtn-cream">
                  <span className="font-medium">@{t.fromUser.username}</span> wants to transfer{" "}
                  {t.target.slug && t.target.kind ? (
                    <Link href={`${KIND_PATH_PREFIX[t.target.kind]}/${t.target.slug}`} className="font-medium text-curtn-coral hover:underline">
                      {t.target.name}
                    </Link>
                  ) : (
                    <span className="font-medium">{t.target.name ?? "a unit"}</span>
                  )}{" "}
                  to you.
                </p>
                {t.message && (
                  <p className="text-xs text-curtn-muted italic">&ldquo;{t.message}&rdquo;</p>
                )}
                <div className="flex gap-2">
                  <button
                    onClick={() => handleRespond(t.id, true)}
                    disabled={respondingTransfer}
                    className="rounded-md bg-green-500/20 px-3 py-1.5 text-xs font-medium text-green-400 hover:bg-green-500/30 transition-colors disabled:opacity-50"
                  >
                    Accept
                  </button>
                  <button
                    onClick={() => handleRespond(t.id, false)}
                    disabled={respondingTransfer}
                    className="rounded-md bg-red-500/20 px-3 py-1.5 text-xs font-medium text-red-400 hover:bg-red-500/30 transition-colors disabled:opacity-50"
                  >
                    Decline
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Pending claim requests */}
      {!loading && pendingRequests.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-xs uppercase tracking-widest text-curtn-muted">Pending claims</h2>
          <div className="space-y-3">
            {pendingRequests.map((req) => {
              const target = resolveTarget(req);
              const status = REQUEST_STATUS_LABELS[req.status] ?? { label: req.status, color: "" };
              return (
                <div key={req.id} className="rounded-lg border border-curtn-dark bg-curtn-surface p-4">
                  <div className="flex items-center justify-between gap-3 mb-2">
                    <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider ${status.color}`}>
                      {status.label}
                    </span>
                    <span className="text-xs text-curtn-muted">Submitted {timeSince(req.requestedAt)}</span>
                  </div>
                  <p className="text-sm text-curtn-cream">
                    {target?.slug && target.kind ? (
                      <Link href={`${KIND_PATH_PREFIX[target.kind]}/${target.slug}`} className="font-medium text-curtn-coral hover:underline">
                        {target.name}
                      </Link>
                    ) : (
                      <span className="font-medium">{target?.name ?? "(unknown)"}</span>
                    )}
                    {target?.kind && <span className="ml-2 text-xs text-curtn-muted">{KIND_LABELS[target.kind]}</span>}
                  </p>
                  {req.message && (
                    <p className="mt-2 text-xs text-curtn-muted/80 italic line-clamp-3">&ldquo;{req.message}&rdquo;</p>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Active claims */}
      {!loading && (
        <section className="space-y-3">
          <h2 className="text-xs uppercase tracking-widest text-curtn-muted">Units you steward</h2>
          {claims.length === 0 ? (
            <div className="rounded-lg border border-curtn-dark bg-curtn-surface px-6 py-10 text-center">
              <p className="text-sm text-curtn-muted">
                You haven't claimed anything yet. Find a venue, production company, or profile and click "Claim" to start.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {claims.map((claim) => {
                const state = STATE_LABELS[claim.claimState] ?? { label: claim.claimState, color: "" };
                const isTransferring = transferFormFor?.kind === claim.kind && transferFormFor?.targetId === claim.targetId;
                return (
                  <div key={`${claim.kind}-${claim.targetId}`} className="rounded-lg border border-curtn-dark bg-curtn-surface">
                    <div className="p-4">
                      <div className="flex items-center justify-between gap-3 mb-2">
                        <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider ${state.color}`}>
                          {state.label}
                        </span>
                        <span className="text-xs text-curtn-muted">
                          {KIND_LABELS[claim.kind]}
                          {claim.claimedAt && ` · since ${timeSince(claim.claimedAt)}`}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <Link
                          href={`${KIND_PATH_PREFIX[claim.kind]}/${claim.slug}`}
                          className="text-sm font-medium text-curtn-cream hover:text-curtn-coral transition-colors"
                        >
                          {claim.name}
                        </Link>
                        <button
                          onClick={() => {
                            setTransferFormFor(isTransferring ? null : claim);
                            setTransferRecipient("");
                            setTransferMessage("");
                            setTransferError(null);
                          }}
                          className="text-[11px] text-curtn-muted hover:text-curtn-cream transition-colors"
                        >
                          {isTransferring ? "Cancel" : "Transfer →"}
                        </button>
                      </div>
                      {claim.syncHealth === "stale" && (
                        <p className="mt-1 text-[11px] text-yellow-300">
                          Sync feed has been silent — review soon to keep the claim active.
                        </p>
                      )}

                      {/* Phase 6 — sync source controls per venue claim. */}
                      {claim.kind === "venue" && (
                        <SyncSourceControls
                          claim={claim}
                          sync={syncByVenueId.get(claim.targetId) ?? null}
                          onConnect={() => setSyncModalFor(claim)}
                          onDisconnect={handleDisconnectSync}
                        />
                      )}
                    </div>

                    {isTransferring && (
                      <div className="border-t border-curtn-dark p-4 space-y-3 bg-curtn-deep/40">
                        <p className="text-xs text-curtn-muted">
                          Transfer this claim to another Curtn user. They have 14 days to accept.
                        </p>
                        <input
                          type="text"
                          value={transferRecipient}
                          onChange={(e) => setTransferRecipient(e.target.value)}
                          placeholder="Username (e.g. peter)"
                          className="w-full rounded-md border border-curtn-dark bg-curtn-deep px-3 py-2 text-xs text-curtn-cream placeholder:text-curtn-muted/60 focus:border-curtn-coral focus:outline-none"
                        />
                        <textarea
                          value={transferMessage}
                          onChange={(e) => setTransferMessage(e.target.value)}
                          placeholder="Optional message"
                          rows={2}
                          className="w-full rounded-md border border-curtn-dark bg-curtn-deep px-3 py-2 text-xs text-curtn-cream placeholder:text-curtn-muted/60 focus:border-curtn-coral focus:outline-none"
                        />
                        {transferError && (
                          <p className="text-xs text-red-300">{transferError}</p>
                        )}
                        <button
                          onClick={handleInitiateTransfer}
                          disabled={initiatingTransfer}
                          className="rounded-md bg-curtn-coral px-3 py-1.5 text-xs font-bold text-curtn-deep hover:bg-curtn-red transition-colors disabled:opacity-50"
                        >
                          {initiatingTransfer ? "Sending..." : "Send transfer request"}
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* Past claim requests */}
      {!loading && resolvedRequests.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-xs uppercase tracking-widest text-curtn-muted">Past claim requests</h2>
          <div className="space-y-3">
            {resolvedRequests.map((req) => {
              const target = resolveTarget(req);
              const status = REQUEST_STATUS_LABELS[req.status] ?? { label: req.status, color: "" };
              return (
                <div key={req.id} className="rounded-lg border border-curtn-dark bg-curtn-surface/40 p-4">
                  <div className="flex items-center justify-between gap-3 mb-2">
                    <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider ${status.color}`}>
                      {status.label}
                    </span>
                    <span className="text-xs text-curtn-muted">
                      {req.reviewedAt ? `Reviewed ${timeSince(req.reviewedAt)}` : ""}
                    </span>
                  </div>
                  <p className="text-sm text-curtn-cream">
                    <span className="font-medium">{target?.name ?? "(unknown)"}</span>
                    {target?.kind && <span className="ml-2 text-xs text-curtn-muted">{KIND_LABELS[target.kind]}</span>}
                  </p>
                  {req.reviewerNotes && (
                    <p className="mt-1 text-[11px] text-curtn-muted/80">Reviewer notes: {req.reviewerNotes}</p>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {syncModalFor && (
        <ConnectSyncSourceModal
          targetKind="venue"
          targetId={syncModalFor.targetId}
          targetName={syncModalFor.name}
          onClose={() => setSyncModalFor(null)}
          onConnected={() => {
            setSyncModalFor(null);
            setStatusMessage("Sync source connected.");
            refetchSyncs({ requestPolicy: "network-only" });
            refetchClaims({ requestPolicy: "network-only" });
          }}
        />
      )}
    </div>
  );
}

function SyncSourceControls({
  claim,
  sync,
  onConnect,
  onDisconnect,
}: {
  claim: MyClaim;
  sync: ClaimantSync | null;
  onConnect: () => void;
  onDisconnect: (syncId: string) => void;
}) {
  if (claim.claimState === "claimed-passive" && !sync) {
    return (
      <div className="mt-3 pt-3 border-t border-curtn-dark/60">
        <button
          onClick={onConnect}
          className="text-[11px] uppercase tracking-widest text-curtn-coral hover:text-curtn-red"
        >
          Connect a sync source →
        </button>
      </div>
    );
  }
  if (sync) {
    const lastSync = sync.lastSuccessAt
      ? `Last sync ${timeSince(sync.lastSuccessAt)}`
      : "Awaiting first sync";
    const healthLabel =
      claim.syncHealth === "stale" ? "Stale" : sync.healthStatus === "needs-attention" ? "Needs attention" : "Healthy";
    const healthClass =
      claim.syncHealth === "stale"
        ? "bg-yellow-500/20 text-yellow-300"
        : sync.healthStatus === "needs-attention"
          ? "bg-yellow-500/20 text-yellow-300"
          : "bg-green-500/20 text-green-400";
    return (
      <div className="mt-3 pt-3 border-t border-curtn-dark/60 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[11px] text-curtn-muted truncate" title={sync.url ?? ""}>
              {sync.type.toUpperCase()} · {sync.url ?? "(no URL)"}
            </p>
            <p className="text-[10px] text-curtn-muted/80 mt-0.5">{lastSync}</p>
          </div>
          <span className={`shrink-0 inline-block rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider ${healthClass}`}>
            {healthLabel}
          </span>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => onDisconnect(sync.id)}
            className="text-[10px] uppercase tracking-widest text-curtn-muted hover:text-red-300"
          >
            Disconnect
          </button>
        </div>
      </div>
    );
  }
  return null;
}
