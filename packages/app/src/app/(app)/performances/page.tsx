"use client";

import { Suspense, useState } from "react";
import { useQuery } from "urql";
import { ShowGrid } from "@/components/shows/ShowGrid";
import { SHOW_LIST_QUERY } from "@/lib/graphql/shows";

const PAGE_SIZE = 12;

function ShowsBrowser() {
  const [after, setAfter] = useState<string | null>(null);
  const [prevEdges, setPrevEdges] = useState<any[]>([]);

  const [result] = useQuery({
    query: SHOW_LIST_QUERY,
    variables: {
      first: PAGE_SIZE,
      after,
    },
  });

  const connection = result.data?.showList;
  const currentEdges = connection?.edges ?? [];
  const pageInfo = connection?.pageInfo;
  const allEdges = after === null ? currentEdges : [...prevEdges, ...currentEdges];
  const shows = allEdges.map((e: any) => e.node);

  function handleLoadMore() {
    if (pageInfo?.endCursor) {
      setPrevEdges(allEdges);
      setAfter(pageInfo.endCursor);
    }
  }

  return (
    <>
      <ShowGrid shows={shows} loading={result.fetching && after === null} />

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
