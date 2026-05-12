"use client";

import { useState } from "react";
import Link from "next/link";
import { useMutation } from "urql";
import {
  APPROVE_PROPOSAL_MUTATION,
  DECLINE_PROPOSAL_MUTATION,
} from "@/lib/graphql/dashboard";

// Phase 4 — Proposal card. Used in both the dashboard queue and the in-context
// strip on entity detail pages. The shape is intentionally identical: same
// approve/decline buttons, same author + target + diff preview, same auto-
// approve-future toggle.

const TARGET_KIND_LABELS: Record<string, string> = {
  Venue: "Venue",
  ProductionCompany: "Company",
  Person: "Profile",
  Show: "Show",
  Run: "Run",
  Performance: "Performance",
  Stage: "Stage",
};

const TARGET_PATH_PREFIX: Record<string, string> = {
  Venue: "/venues",
  ProductionCompany: "/companies",
  Person: "/people",
};

export interface ProposalCardData {
  id: string;
  diffJson: string;
  isJointStewardship: boolean;
  firstApprovalAt: string | null;
  conflictsWithProposalIds: string[];
  createdAt: string;
  target: { kind: string; targetId: string; name: string | null; slug: string | null };
  proposer: {
    kind: string;
    label: string | null;
    user: { id: string; username: string; fullName: string } | null;
  };
  approvals: { userId: string; role: string; approvedAt: string }[];
}

function decodeId(globalId: string): string {
  return atob(globalId).split(":")[1];
}

function timeSince(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const hours = Math.floor(diff / (1000 * 60 * 60));
  if (hours < 1) return "just now";
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function parseDiff(json: string): Record<string, { old: any; new: any }> {
  try { return JSON.parse(json); } catch { return {}; }
}

function formatValue(v: any): string {
  if (v === null || v === undefined) return "—";
  if (typeof v === "string") return v.length > 80 ? `${v.slice(0, 80)}…` : v;
  if (typeof v === "boolean") return v ? "Yes" : "No";
  if (typeof v === "number") return String(v);
  return JSON.stringify(v);
}

export function ProposalCard({
  proposal,
  onActionDone,
  highlightConflict,
}: {
  proposal: ProposalCardData;
  onActionDone?: () => void;
  highlightConflict?: boolean;
}) {
  const diff = parseDiff(proposal.diffJson);
  const diffFields = Object.keys(diff).filter(k => !k.startsWith("_"));
  const isPendingImport = !!diff._pendingImport;

  const [expanded, setExpanded] = useState(false);
  const [autoApproveFuture, setAutoApproveFuture] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const [{ fetching: approving }, executeApprove] = useMutation(APPROVE_PROPOSAL_MUTATION);
  const [{ fetching: declining }, executeDecline] = useMutation(DECLINE_PROPOSAL_MUTATION);

  const targetLabel = TARGET_KIND_LABELS[proposal.target.kind] ?? proposal.target.kind;
  const targetPath =
    proposal.target.slug && TARGET_PATH_PREFIX[proposal.target.kind]
      ? `${TARGET_PATH_PREFIX[proposal.target.kind]}/${proposal.target.slug}`
      : null;
  const authorLabel =
    proposal.proposer.kind === "Scraper"
      ? proposal.proposer.label ?? "Scraper"
      : proposal.proposer.user
      ? `@${proposal.proposer.user.username}`
      : proposal.proposer.label ?? "Unknown";

  async function handleApprove() {
    setStatusMessage(null);
    const res = await executeApprove({
      input: {
        proposalId: decodeId(proposal.id),
        autoApproveFutureFromProposer: autoApproveFuture,
      },
    });
    const payload = res.data?.approveProposal;
    if (payload?.error) { setStatusMessage(payload.error); return; }
    setStatusMessage(payload?.applied ? "Approved." : "Vote recorded. Waiting for the other claimant.");
    onActionDone?.();
  }

  async function handleDecline() {
    setStatusMessage(null);
    const res = await executeDecline({
      input: { proposalId: decodeId(proposal.id) },
    });
    const payload = res.data?.declineProposal;
    if (payload?.error) { setStatusMessage(payload.error); return; }
    setStatusMessage("Declined.");
    onActionDone?.();
  }

  return (
    <div
      className={`rounded-lg border p-4 space-y-3 ${
        highlightConflict
          ? "border-yellow-500/40 bg-yellow-500/5"
          : "border-curtn-dark bg-curtn-surface"
      }`}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2 text-[11px]">
          <span className="inline-block rounded-full bg-curtn-deep px-2 py-0.5 uppercase tracking-wider text-curtn-muted">
            {proposal.proposer.kind === "Scraper" ? "Scraper" : "Member"}
          </span>
          <span className="text-curtn-cream font-medium">{authorLabel}</span>
          <span className="text-curtn-muted">on</span>
          {targetPath ? (
            <Link href={targetPath} className="text-curtn-coral hover:underline font-medium">
              {proposal.target.name ?? "(unknown)"}
            </Link>
          ) : (
            <span className="text-curtn-cream font-medium">{proposal.target.name ?? "(unknown)"}</span>
          )}
          <span className="text-curtn-muted">·</span>
          <span className="text-curtn-muted">{targetLabel}</span>
          {proposal.isJointStewardship && (
            <span className="inline-block rounded-full bg-blue-500/15 px-2 py-0.5 text-blue-300">Joint</span>
          )}
          {isPendingImport && (
            <span className="inline-block rounded-full bg-purple-500/15 px-2 py-0.5 text-purple-300">New import</span>
          )}
        </div>
        <span className="text-[11px] text-curtn-muted shrink-0">{timeSince(proposal.createdAt)}</span>
      </div>

      {/* Diff preview */}
      {!isPendingImport && diffFields.length > 0 && (
        <div className="text-xs text-curtn-cream space-y-1">
          {(expanded ? diffFields : diffFields.slice(0, 2)).map(field => {
            const entry = diff[field];
            return (
              <div key={field} className="flex flex-wrap gap-2">
                <span className="text-curtn-muted">{field}:</span>
                <span className="line-through text-curtn-muted/60">{formatValue(entry?.old)}</span>
                <span className="text-curtn-cream">→ {formatValue(entry?.new)}</span>
              </div>
            );
          })}
          {diffFields.length > 2 && (
            <button
              onClick={() => setExpanded(v => !v)}
              className="text-[11px] text-curtn-coral hover:underline"
            >
              {expanded ? "Show less" : `Show ${diffFields.length - 2} more`}
            </button>
          )}
        </div>
      )}

      {isPendingImport && (
        <div className="text-xs text-curtn-muted">
          New performance import from the scraper. Approving adds it to the archive.
        </div>
      )}

      {proposal.isJointStewardship && proposal.approvals.length > 0 && (
        <div className="text-[11px] text-blue-300">
          {proposal.approvals.length === 1
            ? `${proposal.approvals[0].role === "venue-claimant" ? "Venue side" : "Company side"} has approved. Waiting on the other.`
            : "Both sides approved."}
        </div>
      )}

      {/* Trusted-editor stub (Phase 5 will consume) */}
      <label className="flex items-center gap-2 text-[11px] text-curtn-muted cursor-pointer select-none">
        <input
          type="checkbox"
          checked={autoApproveFuture}
          onChange={e => setAutoApproveFuture(e.target.checked)}
          className="accent-curtn-coral"
        />
        Auto-approve future edits from {authorLabel}
      </label>

      <div className="flex flex-wrap gap-2">
        <button
          onClick={handleApprove}
          disabled={approving || declining}
          className="rounded-md bg-green-500/20 px-3 py-1.5 text-xs font-medium text-green-400 hover:bg-green-500/30 transition-colors disabled:opacity-50"
        >
          {approving ? "Approving…" : "Approve"}
        </button>
        <button
          onClick={handleDecline}
          disabled={approving || declining}
          className="rounded-md bg-red-500/20 px-3 py-1.5 text-xs font-medium text-red-400 hover:bg-red-500/30 transition-colors disabled:opacity-50"
        >
          {declining ? "Declining…" : "Decline"}
        </button>
      </div>

      {statusMessage && (
        <p className="text-[11px] text-curtn-muted">{statusMessage}</p>
      )}
    </div>
  );
}
