"use client";

import Link from "next/link";
import { useQuery } from "urql";
import { COMMUNITY_REVIEW_PROPOSALS_QUERY } from "@/lib/graphql/dashboard";
import { ProposalCard, ProposalCardData } from "@/components/proposals/ProposalCard";
import { useAuth } from "@/lib/auth/useAuth";

// Phase 7 — community-review queue. Visible to admins + autoconfirmed users
// (the server query enforces this; non-eligible users get an empty list).
// Any qualified caller can approve or decline; the existing approve/decline
// mutations branch on Proposal.isCommunityReview to fire the correct
// notification kinds and write the `community-approved` AuditLog row.

export default function CommunityReviewPage() {
  const { user, isLoading: authLoading } = useAuth();
  const [{ data, fetching, error }, refetch] = useQuery({
    query: COMMUNITY_REVIEW_PROPOSALS_QUERY,
    variables: {},
    pause: !user,
  });

  if (authLoading) {
    return <div className="p-6 text-curtn-muted">Loading…</div>;
  }
  if (!user) {
    return (
      <div className="p-6 text-curtn-cream">
        Please <Link href="/login" className="text-curtn-coral hover:underline">sign in</Link> to view community review.
      </div>
    );
  }

  const proposals: ProposalCardData[] = data?.communityReviewProposals ?? [];

  return (
    <div className="mx-auto max-w-4xl p-6 space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold text-curtn-cream">Community review</h1>
        <p className="text-sm text-curtn-muted">
          Edits to unclaimed records from new accounts. Autoconfirmed users + admins can approve or decline.
        </p>
      </header>

      {error && (
        <div className="rounded-lg border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-200">
          {error.message}
        </div>
      )}

      {fetching && proposals.length === 0 ? (
        <div className="text-curtn-muted">Loading proposals…</div>
      ) : proposals.length === 0 ? (
        <div className="rounded-lg border border-curtn-dark bg-curtn-surface/40 p-6 text-curtn-muted">
          No community-review proposals right now. If you don't see this queue and expect to, you may not yet be autoconfirmed (10 edits + 4 days).
        </div>
      ) : (
        <div className="space-y-3">
          {proposals.map((p) => (
            <ProposalCard
              key={p.id}
              proposal={p}
              onActionDone={() => refetch({ requestPolicy: "network-only" })}
            />
          ))}
        </div>
      )}
    </div>
  );
}
