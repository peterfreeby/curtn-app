"use client";

import { Suspense, useState, useCallback, useMemo } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useQuery } from "urql";
import { PerformanceFilters } from "@/components/performances/PerformanceFilters";
import { ShowGrid } from "@/components/shows/ShowGrid";
import {
  SHOW_LIST_QUERY,
  SEARCH_SHOWS_QUERY,
} from "@/lib/graphql/shows";

const PAGE_SIZE = 12;

function ShowsBrowser() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const search = searchParams.get("q") ?? "";
  const typesParam = searchParams.get("types") ?? "";
  const selectedTypes = typesParam ? typesParam.split(",") : [];
  const autoFocus = searchParams.has("focus");

  const [after, setAfter] = useState<string | null>(null);
  const [prevEdges, setPrevEdges] = useState<any[]>([]);

  const isSearching = search.length > 0;

  const [listResult] = useQuery({
    query: SHOW_LIST_QUERY,
    variables: {
      first: PAGE_SIZE,
      after,
      performanceTypes: selectedTypes.length > 0 ? selectedTypes : undefined,
    },
    pause: isSearching,
  });

  const [searchResult] = useQuery({
    query: SEARCH_SHOWS_QUERY,
    variables: {
      query: search,
      first: PAGE_SIZE,
      after,
    },
    pause: !isSearching,
  });

  const result = isSearching ? searchResult : listResult;
  const connection = isSearching
    ? result.data?.searchShows
    : result.data?.showList;
  const currentEdges = connection?.edges ?? [];
  const pageInfo = connection?.pageInfo;

  const filteredEdges = useMemo(() => {
    const allEdges = after === null ? currentEdges : [...prevEdges, ...currentEdges];
    if (!isSearching || selectedTypes.length === 0) return allEdges;
    return allEdges.filter((edge: any) =>
      edge.node.performanceTypes.some((t: string) => selectedTypes.includes(t))
    );
  }, [currentEdges, prevEdges, after, isSearching, selectedTypes]);

  const shows = filteredEdges.map((e: any) => e.node);

  function updateParams(updates: Record<string, string | null>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(updates)) {
      if (value === null || value === "") params.delete(key);
      else params.set(key, value);
    }
    params.delete("focus");
    setAfter(null);
    setPrevEdges([]);
    router.replace(`/performances?${params.toString()}`, { scroll: false });
  }

  const handleSearchChange = useCallback(
    (value: string) => updateParams({ q: value || null }),
    [searchParams]
  );

  const handleTypesChange = useCallback(
    (types: string[]) => updateParams({ types: types.length > 0 ? types.join(",") : null }),
    [searchParams]
  );

  const handleUpcomingChange = useCallback(
    (value: boolean) => updateParams({ upcoming: value ? "true" : null }),
    [searchParams]
  );

  function handleLoadMore() {
    if (pageInfo?.endCursor) {
      setPrevEdges(filteredEdges);
      setAfter(pageInfo.endCursor);
    }
  }

  return (
    <>
      <PerformanceFilters
        search={search}
        onSearchChange={handleSearchChange}
        selectedTypes={selectedTypes}
        onTypesChange={handleTypesChange}
        upcoming={false}
        onUpcomingChange={handleUpcomingChange}
        autoFocus={autoFocus}
      />

      <div className="mt-6">
        <ShowGrid shows={shows} loading={result.fetching && after === null} />
      </div>

      {!result.fetching && pageInfo?.hasNextPage && (
        <div className="mt-6 flex justify-center">
          <button
            type="button"
            onClick={handleLoadMore}
            className="rounded-lg border border-curtn-dark px-6 py-2.5 text-sm text-curtn-muted transition-colors hover:border-curtn-muted/50 hover:text-curtn-cream"
          >
            Load more
          </button>
        </div>
      )}

      {result.fetching && after !== null && (
        <div className="mt-6 flex justify-center">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-curtn-muted/30 border-t-curtn-coral" />
        </div>
      )}
    </>
  );
}

export default function PerformancesPage() {
  return (
    <div className="px-6 py-8 max-w-6xl mx-auto">
      <h2 className="text-xs uppercase tracking-widest text-curtn-muted mb-6">
        Browse Shows
      </h2>
      <Suspense
        fallback={
          <div className="mt-6">
            <ShowGrid shows={[]} loading={true} />
          </div>
        }
      >
        <ShowsBrowser />
      </Suspense>
    </div>
  );
}
