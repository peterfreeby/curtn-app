"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "urql";
import { FEED_REVIEWS_QUERY } from "@/lib/graphql/follows";
import { ReviewCard } from "@/components/reviews/ReviewCard";
import { useAuth } from "@/lib/auth/useAuth";

const PAGE_SIZE = 12;

export default function FeedPage() {
  const { user } = useAuth();

  const [after, setAfter] = useState<string | null>(null);
  const [allEdges, setAllEdges] = useState<any[]>([]);

  const [{ data, fetching }] = useQuery({
    query: FEED_REVIEWS_QUERY,
    variables: { first: PAGE_SIZE, after },
    pause: !user,
  });

  const connection = data?.feedReviews;
  const edges = (connection?.edges ?? []).filter((e: any) => e.node != null);
  const pageInfo = connection?.pageInfo;
  const displayEdges = after === null ? edges : [...allEdges, ...edges];

  function loadMore() {
    if (pageInfo?.endCursor) {
      setAllEdges(displayEdges);
      setAfter(pageInfo.endCursor);
    }
  }

  // Not authenticated
  if (!user) {
    return (
      <div className="px-6 py-8 max-w-2xl mx-auto">
        <h2 className="text-xs uppercase tracking-widest text-curtn-muted mb-8">
          Feed
        </h2>
        <div className="empty-state">
          <p className="font-display text-base font-bold uppercase mb-1.5 text-curtn-cream">Sign In to See Your Feed</p>
          <p className="text-xs text-curtn-muted max-w-[260px] mx-auto mb-4">
            Follow people to see their reviews here.
          </p>
          <Link
            href="/login"
            className="inline-block dog-ear dog-ear-dark bg-curtn-coral px-6 py-2.5 text-sm font-semibold text-curtn-deep transition-colors hover:bg-curtn-red"
          >
            Sign in
          </Link>
        </div>
      </div>
    );
  }

  // Loading
  if (fetching && displayEdges.length === 0) {
    return (
      <div className="px-6 py-8 max-w-2xl mx-auto space-y-6">
        <h2 className="text-xs uppercase tracking-widest text-curtn-muted mb-8">
          Feed
        </h2>
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-24 rounded-lg bg-curtn-dark/30 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="px-6 py-8 max-w-2xl mx-auto">
      <h2 className="text-xs uppercase tracking-widest text-curtn-muted mb-8">
        Feed
      </h2>

      {displayEdges.length === 0 ? (
        <div className="empty-state">
          <p className="font-display text-base font-bold uppercase mb-1.5 text-curtn-cream">Your Feed Is Empty</p>
          <p className="text-xs text-curtn-muted max-w-[260px] mx-auto mb-4">
            Follow people to see their reviews here.
          </p>
          <Link
            href="/browse"
            className="inline-block border border-curtn-dark px-6 py-2.5 text-sm text-curtn-muted transition-colors hover:border-curtn-muted/50 hover:text-curtn-cream"
          >
            Browse performances
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {displayEdges.map((edge: any) => (
            <ReviewCard
              key={edge.node.id}
              review={edge.node}
              showPerformanceLink
            />
          ))}
        </div>
      )}

      {fetching && displayEdges.length > 0 && (
        <div className="mt-3 flex justify-center">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-curtn-muted/30 border-t-curtn-coral" />
        </div>
      )}

      {!fetching && pageInfo?.hasNextPage && (
        <button
          type="button"
          onClick={loadMore}
          className="mt-4 w-full rounded-lg border border-curtn-dark py-2.5 text-sm text-curtn-muted transition-colors hover:border-curtn-muted/50 hover:text-curtn-cream cursor-pointer"
        >
          Load more
        </button>
      )}
    </div>
  );
}
