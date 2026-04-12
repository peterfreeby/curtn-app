"use client";

import { useMemo } from "react";
import Link from "next/link";
import { FEED_REVIEWS_QUERY, FEED_SEEN_QUERY } from "@/lib/graphql/follows";
import { ReviewCard } from "@/components/reviews/ReviewCard";
import { SeenCard } from "@/components/seen/SeenCard";
import { InfiniteScrollSentinel } from "@/components/InfiniteScrollSentinel";
import { usePaginatedConnection } from "@/hooks/usePaginatedConnection";
import { useQuery } from "urql";
import { useAuth } from "@/lib/auth/useAuth";

export default function FeedPage() {
  const { user } = useAuth();

  const { edges: reviewEdges, loading, loadingMore, hasNextPage, sentinelRef } =
    usePaginatedConnection({
      query: FEED_REVIEWS_QUERY,
      pageSize: 12,
      pause: !user,
      getConnection: (data: any) => data?.feedReviews,
    });

  // Fetch recent seen entries from followed users (non-paginated, first batch)
  const [{ data: seenData }] = useQuery({
    query: FEED_SEEN_QUERY,
    variables: { first: 20 },
    pause: !user,
  });

  const seenEdges = seenData?.feedSeen?.edges ?? [];

  // Merge reviews and seens, sorted by createdAt descending
  const mergedFeed = useMemo(() => {
    const tagged = [
      ...reviewEdges.map((e: any) => ({ type: "review" as const, node: e.node, createdAt: e.node.createdAt })),
      ...seenEdges.map((e: any) => ({ type: "seen" as const, node: e.node, createdAt: e.node.createdAt })),
    ];
    tagged.sort((a, b) => {
      const da = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const db = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return db - da;
    });
    return tagged;
  }, [reviewEdges, seenEdges]);

  // Not authenticated
  if (!user) {
    return (
      <div className="px-2 sm:px-6 py-8 max-w-2xl mx-auto">
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
  if (loading) {
    return (
      <div className="px-2 sm:px-6 py-8 max-w-2xl mx-auto space-y-6">
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
    <div className="px-2 sm:px-6 py-8 max-w-2xl mx-auto">
      <h2 className="text-xs uppercase tracking-widest text-curtn-muted mb-8">
        Feed
      </h2>

      {mergedFeed.length === 0 ? (
        <div className="empty-state">
          <p className="font-display text-base font-bold uppercase mb-1.5 text-curtn-cream">Your Feed Is Empty</p>
          <p className="text-xs text-curtn-muted max-w-[260px] mx-auto mb-4">
            Follow people to see their activity here.
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
          {mergedFeed.map((item) =>
            item.type === "review" ? (
              <ReviewCard
                key={`review-${item.node.id}`}
                review={item.node}
                showPerformanceLink
              />
            ) : (
              <SeenCard
                key={`seen-${item.node.id}`}
                seen={item.node}
                showUser
              />
            )
          )}
        </div>
      )}

      <InfiniteScrollSentinel
        sentinelRef={sentinelRef}
        loadingMore={loadingMore}
        hasNextPage={hasNextPage}
      />
    </div>
  );
}
