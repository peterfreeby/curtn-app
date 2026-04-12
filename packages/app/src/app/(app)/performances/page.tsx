"use client";

import { Suspense } from "react";
import { ShowGrid } from "@/components/shows/ShowGrid";
import { SHOW_LIST_QUERY } from "@/lib/graphql/shows";
import { InfiniteScrollSentinel } from "@/components/InfiniteScrollSentinel";
import { usePaginatedConnection } from "@/hooks/usePaginatedConnection";

function ShowsBrowser() {
  const { edges, loading, loadingMore, hasNextPage, sentinelRef } =
    usePaginatedConnection({
      query: SHOW_LIST_QUERY,
      pageSize: 12,
      getConnection: (data: any) => data?.showList,
    });

  const shows = edges.map((e: any) => e.node);

  return (
    <>
      <ShowGrid shows={shows} loading={loading} />
      <InfiniteScrollSentinel
        sentinelRef={sentinelRef}
        loadingMore={loadingMore}
        hasNextPage={hasNextPage}
      />
    </>
  );
}

export default function PerformancesPage() {
  return (
    <div className="px-2 sm:px-6 py-8 max-w-6xl mx-auto">
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
