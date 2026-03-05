"use client";

import { useState } from "react";
import { useQuery } from "urql";
import { REVIEW_LIST_QUERY } from "@/lib/graphql/reviews";
import { ReviewCard } from "@/components/reviews/ReviewCard";
import { Card } from "@/components/Card";

const PAGE_SIZE = 12;

export default function ReviewsPage() {
  const [after, setAfter] = useState<string | null>(null);
  const [allEdges, setAllEdges] = useState<any[]>([]);

  const [{ data, fetching }, reexecute] = useQuery({
    query: REVIEW_LIST_QUERY,
    variables: { first: PAGE_SIZE, after },
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
    // Re-fetch current page
    setAfter(null);
    setAllEdges([]);
    reexecute({ requestPolicy: "network-only" });
  }

  if (fetching && displayEdges.length === 0) {
    return (
      <div className="px-6 py-8 max-w-2xl mx-auto">
        <h2 className="text-xs uppercase tracking-widest text-curtn-muted mb-8">
          Recent Reviews
        </h2>
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="h-24 rounded-lg bg-curtn-dark/30 animate-pulse"
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="px-6 py-8 max-w-2xl mx-auto">
      <h2 className="text-xs uppercase tracking-widest text-curtn-muted mb-8">
        Recent Reviews
      </h2>

      {displayEdges.length === 0 ? (
        <Card className="text-center py-16 space-y-4">
          <p className="text-curtn-muted">No reviews yet.</p>
          <p className="text-xs text-curtn-muted/60">
            Be the first to share what moved you.
          </p>
        </Card>
      ) : (
        <div className="space-y-3">
          {displayEdges.map((edge: any) => (
            <ReviewCard
              key={edge.node.id}
              review={edge.node}
              showPerformanceLink
              onDeleted={handleDeleted}
            />
          ))}
        </div>
      )}

      {fetching && (
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
          Load more reviews
        </button>
      )}
    </div>
  );
}
