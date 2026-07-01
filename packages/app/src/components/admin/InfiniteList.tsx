"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useQuery } from "urql";

interface InfiniteListProps {
  query: any;
  /** Root field on the query result holding the Relay connection (e.g. "editorialLists"). */
  connectionKey: string;
  /** Base query variables (first/after are managed internally). */
  variables?: Record<string, any>;
  pageSize?: number;
  renderItem: (node: any) => ReactNode;
  /** Optional client-side filter applied to loaded nodes. */
  filter?: (node: any) => boolean;
  /** Rendered inside the scroll area, above the paginated items. */
  prepend?: ReactNode;
  /** Change this to reset pagination and refetch from the first page (e.g. after a mutation). */
  resetKey?: unknown;
  maxHeight?: string;
  emptyText?: string;
}

export function InfiniteList({
  query,
  connectionKey,
  variables = {},
  pageSize = 20,
  renderItem,
  filter,
  prepend,
  resetKey,
  maxHeight = "32rem",
  emptyText = "Nothing here yet.",
}: InfiniteListProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const [after, setAfter] = useState<string | null>(null);
  const [prevEdges, setPrevEdges] = useState<any[]>([]);

  const [result, reexecute] = useQuery({
    query,
    variables: { ...variables, first: pageSize, after },
    requestPolicy: "cache-and-network",
  });

  const connection = result.data?.[connectionKey];
  const currentEdges = connection?.edges ?? [];
  const pageInfo = connection?.pageInfo;
  const allEdges = after === null ? currentEdges : [...prevEdges, ...currentEdges];

  // Reset to the first page whenever resetKey changes (e.g. after a mutation).
  useEffect(() => {
    setPrevEdges([]);
    setAfter(null);
    reexecute({ requestPolicy: "network-only" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetKey]);

  // Load the next page when the sentinel scrolls into view within the scroll area.
  useEffect(() => {
    const sentinel = sentinelRef.current;
    const root = scrollRef.current;
    if (!sentinel || !root) return;
    if (result.fetching) return;
    if (!pageInfo?.hasNextPage || !pageInfo.endCursor) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setPrevEdges(allEdges);
          setAfter(pageInfo.endCursor!);
        }
      },
      { root, rootMargin: "200px" }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [result.fetching, pageInfo?.hasNextPage, pageInfo?.endCursor, allEdges]);

  const nodes = allEdges.map((e: any) => e.node);
  const visible = filter ? nodes.filter(filter) : nodes;
  const isEmpty = visible.length === 0 && !prepend && !result.fetching;

  return (
    <div
      ref={scrollRef}
      className="space-y-1 overflow-y-auto pr-1"
      style={{ maxHeight }}
    >
      {prepend}
      {visible.map(renderItem)}

      {isEmpty && (
        <p className="text-xs text-curtn-muted/50">{emptyText}</p>
      )}

      {pageInfo?.hasNextPage && (
        <div ref={sentinelRef} className="flex justify-center py-3" aria-hidden>
          {result.fetching && (
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-curtn-muted/30 border-t-curtn-coral" />
          )}
        </div>
      )}
    </div>
  );
}
