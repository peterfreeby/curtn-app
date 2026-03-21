"use client";

import { useQuery } from "urql";
import { useState } from "react";
import { RUN_REVIEWS_QUERY } from "@/lib/graphql/performances";
import { ReviewCard } from "@/components/reviews/ReviewCard";

interface ReviewsListProps {
  runId: string;
}

const PAGE_SIZE = 12;

export function ReviewsList({ runId }: ReviewsListProps) {
  const [after, setAfter] = useState<string | null>(null);
  const [allEdges, setAllEdges] = useState<any[]>([]);

  const [{ data, fetching }, reexecute] = useQuery({
    query: RUN_REVIEWS_QUERY,
    variables: { runId, first: PAGE_SIZE, after },
  });

  const connection = data?.reviewList;
  const edges = (connection?.edges ?? []).filter((e: any) => e.node != null);
  const pageInfo = connection?.pageInfo;

  const displayEdges = after === null ? edges : [...allEdges, ...edges];

  function loadMore() {
    if (pageInfo?.endCursor) {
      setAllEdges(displayEdges);
      setAfter(pageInfo.endCursor);
    }
  }

  function handleDeleted() {
    setAfter(null);
    setAllEdges([]);
    reexecute({ requestPolicy: "network-only" });
  }

  if (!fetching && displayEdges.length === 0) {
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
        Reviews{connection && ` (${displayEdges.length}${pageInfo?.hasNextPage ? "+" : ""})`}
      </h2>

      <div className="space-y-3">
        {displayEdges.map((edge: any) => (
          <ReviewCard
            key={edge.node.id}
            review={edge.node}
            onDeleted={handleDeleted}
          />
        ))}
      </div>

      {fetching && (
        <div className="mt-3 flex justify-center">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-curtn-muted/30 border-t-curtn-coral" />
        </div>
      )}

      {!fetching && pageInfo?.hasNextPage && (
        <button
          type="button"
          onClick={loadMore}
          className="mt-4 w-full border border-curtn-dark py-2.5 text-sm text-curtn-muted transition-colors hover:border-curtn-muted/50 hover:text-curtn-cream cursor-pointer"
        >
          Load more reviews
        </button>
      )}
    </div>
  );
}
