"use client";

import { useState } from "react";
import { useQuery } from "urql";
import { REVIEW_LIST_QUERY } from "@/lib/graphql/reviews";
import { ReviewCard } from "@/components/reviews/ReviewCard";
import { useAuth } from "@/lib/auth/useAuth";

const PAGE_SIZE = 12;

export default function ReviewsPage() {
  const { user } = useAuth();
  const [after, setAfter] = useState<string | null>(null);
  const [allEdges, setAllEdges] = useState<any[]>([]);
  const [followedOnly, setFollowedOnly] = useState(false);

  const [{ data, fetching }, reexecute] = useQuery({
    query: REVIEW_LIST_QUERY,
    variables: { first: PAGE_SIZE, after, followedOnly: followedOnly || undefined },
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

  function handleFollowedChange(v: boolean) {
    setFollowedOnly(v);
    setAfter(null);
    setAllEdges([]);
  }

  if (fetching && displayEdges.length === 0) {
    return (
      <div className="px-4 sm:px-6 py-8 max-w-2xl mx-auto">
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
    <div className="px-4 sm:px-6 py-8 max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <h2 className="text-xs uppercase tracking-widest text-curtn-muted">
          Recent Reviews
        </h2>
        {!!user && (
          <div className="flex rounded-lg border border-curtn-dark overflow-hidden text-xs">
            <button
              type="button"
              onClick={() => handleFollowedChange(false)}
              className={`px-2.5 py-1 transition-colors cursor-pointer ${
                !followedOnly
                  ? "bg-curtn-dark text-curtn-cream"
                  : "text-curtn-muted hover:text-curtn-cream"
              }`}
            >
              All
            </button>
            <button
              type="button"
              onClick={() => handleFollowedChange(true)}
              className={`px-2.5 py-1 transition-colors cursor-pointer ${
                followedOnly
                  ? "bg-curtn-dark text-curtn-cream"
                  : "text-curtn-muted hover:text-curtn-cream"
              }`}
            >
              Friends
            </button>
          </div>
        )}
      </div>

      {displayEdges.length === 0 ? (
        <div className="empty-state">
          <p className="font-display text-base font-bold uppercase mb-1.5 text-curtn-cream">
            {followedOnly ? "No Friend Reviews Yet" : "No Reviews Yet"}
          </p>
          <p className="text-xs text-curtn-muted max-w-[260px] mx-auto">
            {followedOnly
              ? "None of the people you follow have reviewed anything yet."
              : "Be the first to share what moved you."}
          </p>
        </div>
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
