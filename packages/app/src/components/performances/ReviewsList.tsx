"use client";

import { RUN_REVIEWS_QUERY } from "@/lib/graphql/performances";
import { ReviewCard } from "@/components/reviews/ReviewCard";
import { InfiniteScrollSentinel } from "@/components/InfiniteScrollSentinel";
import { usePaginatedConnection } from "@/hooks/usePaginatedConnection";

interface ReviewsListProps {
  runId: string;
}

export function ReviewsList({ runId }: ReviewsListProps) {
  const { edges, loading, loadingMore, hasNextPage, sentinelRef, reset } =
    usePaginatedConnection({
      query: RUN_REVIEWS_QUERY,
      variables: { runId },
      pageSize: 12,
      getConnection: (data: any) => data?.reviewList,
    });

  if (!loading && edges.length === 0) {
    return (
      <div>
        <h2 className="mb-3 text-xs uppercase tracking-widest text-curtn-muted">Reviews</h2>
        <div className="empty-state">
          <p className="font-display text-base font-bold uppercase mb-1.5 text-curtn-cream">No Reviews Yet</p>
          <p className="text-xs text-curtn-muted max-w-[260px] mx-auto">
            Be the first to share your thoughts.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <h2 className="mb-3 text-xs uppercase tracking-widest text-curtn-muted">
        Reviews{edges.length > 0 && ` (${edges.length}${hasNextPage ? "+" : ""})`}
      </h2>

      <div className="space-y-3">
        {edges.map((edge: any) => (
          <ReviewCard
            key={edge.node.id}
            review={edge.node}
            onDeleted={reset}
          />
        ))}
      </div>

      {loading && (
        <div className="mt-3 flex justify-center">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-curtn-muted/30 border-t-curtn-coral" />
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
