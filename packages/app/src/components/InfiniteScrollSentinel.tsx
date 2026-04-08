"use client";

import { RefObject } from "react";

interface InfiniteScrollSentinelProps {
  sentinelRef: RefObject<HTMLDivElement | null>;
  loadingMore: boolean;
  hasNextPage: boolean;
}

export function InfiniteScrollSentinel({
  sentinelRef,
  loadingMore,
  hasNextPage,
}: InfiniteScrollSentinelProps) {
  if (!hasNextPage && !loadingMore) return null;

  return (
    <div ref={sentinelRef} className="mt-6 flex justify-center py-2">
      {loadingMore && (
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-curtn-muted/30 border-t-curtn-coral" />
      )}
    </div>
  );
}
