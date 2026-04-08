"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery, DocumentInput } from "urql";

interface UsePaginatedConnectionOptions<TData> {
  query: DocumentInput<TData, any>;
  variables?: Record<string, any>;
  pageSize?: number;
  pause?: boolean;
  getConnection: (data: TData) => any | undefined;
}

export function usePaginatedConnection<TData = any>({
  query,
  variables = {},
  pageSize = 12,
  pause = false,
  getConnection,
}: UsePaginatedConnectionOptions<TData>) {
  const [after, setAfter] = useState<string | null>(null);
  const [allEdges, setAllEdges] = useState<any[]>([]);
  const prevVariablesRef = useRef<string>("");

  // Reset pagination when variables change (e.g., filter change)
  const variablesKey = JSON.stringify(variables);
  useEffect(() => {
    if (prevVariablesRef.current && prevVariablesRef.current !== variablesKey) {
      setAfter(null);
      setAllEdges([]);
    }
    prevVariablesRef.current = variablesKey;
  }, [variablesKey]);

  const [{ data, fetching }, reexecute] = useQuery({
    query,
    variables: { first: pageSize, after, ...variables },
    pause,
  });

  const connection = data ? getConnection(data) : undefined;
  const currentEdges = (connection?.edges ?? []).filter((e: any) => e?.node != null);
  const pageInfo = connection?.pageInfo;
  const edges = after === null ? currentEdges : [...allEdges, ...currentEdges];

  const loadMore = useCallback(() => {
    if (pageInfo?.endCursor) {
      setAllEdges(edges);
      setAfter(pageInfo.endCursor);
    }
  }, [pageInfo?.endCursor, edges]);

  const reset = useCallback(() => {
    setAfter(null);
    setAllEdges([]);
    reexecute({ requestPolicy: "network-only" });
  }, [reexecute]);

  // IntersectionObserver for infinite scroll
  const sentinelRef = useRef<HTMLDivElement>(null);
  const loadMoreRef = useRef(loadMore);
  loadMoreRef.current = loadMore;

  useEffect(() => {
    if (!pageInfo?.hasNextPage || fetching) return;

    const el = sentinelRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          loadMoreRef.current();
        }
      },
      { rootMargin: "200px" }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [pageInfo?.hasNextPage, fetching]);

  return {
    edges,
    loading: fetching && allEdges.length === 0 && after === null,
    loadingMore: fetching && (allEdges.length > 0 || after !== null),
    hasNextPage: !!pageInfo?.hasNextPage,
    sentinelRef,
    loadMore,
    reset,
  };
}
