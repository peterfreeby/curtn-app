"use client";

import { useEffect, useState } from "react";
import { useQuery } from "urql";
import { PENDING_PROPOSALS_FOR_TARGET_QUERY } from "@/lib/graphql/dashboard";
import { ProposalCard, ProposalCardData } from "./ProposalCard";

// Phase 4 — in-context "pending edits" strip rendered on a claimable entity's
// detail page when the viewer is a claimant and there are pending proposals.
// Polls at 30s, identical cadence to the dashboard queue.

interface Props {
  targetKind: "Venue" | "ProductionCompany" | "Person" | "Performance" | "Show" | "Run" | "Stage";
  targetId: string;
  /** Whether the current viewer is a claimant of this target. If false, the strip is hidden. */
  isClaimant: boolean;
}

export function PendingProposalsStrip({ targetKind, targetId, isClaimant }: Props) {
  const [collapsed, setCollapsed] = useState(true);
  const [{ data, fetching }, refetch] = useQuery({
    query: PENDING_PROPOSALS_FOR_TARGET_QUERY,
    variables: { targetKind, targetId },
    pause: !isClaimant,
    requestPolicy: "cache-and-network",
  });

  useEffect(() => {
    if (!isClaimant) return;
    const interval = setInterval(() => {
      if (typeof document !== "undefined" && document.visibilityState !== "visible") return;
      refetch({ requestPolicy: "network-only" });
    }, 30_000);
    return () => clearInterval(interval);
  }, [isClaimant, refetch]);

  if (!isClaimant) return null;
  const proposals: ProposalCardData[] = data?.pendingProposalsForTarget ?? [];
  if (proposals.length === 0) return null;

  return (
    <section className="rounded-lg border border-curtn-coral/30 bg-curtn-surface px-4 py-3 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-curtn-cream font-medium">
          {proposals.length} pending {proposals.length === 1 ? "edit" : "edits"} on this {targetKind.toLowerCase()}
        </p>
        <button
          onClick={() => setCollapsed(v => !v)}
          className="text-[11px] text-curtn-coral hover:underline"
        >
          {collapsed ? "Review →" : "Hide"}
        </button>
      </div>
      {!collapsed && (
        <div className="space-y-3">
          {proposals.map(p => (
            <ProposalCard
              key={p.id}
              proposal={p}
              onActionDone={() => refetch({ requestPolicy: "network-only" })}
            />
          ))}
        </div>
      )}
    </section>
  );
}
