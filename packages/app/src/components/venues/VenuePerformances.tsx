"use client";

import { useState } from "react";
import { useQuery } from "urql";
import { VENUE_RUNS_QUERY } from "@/lib/graphql/venues";
import { RunCard } from "@/components/runs/RunCard";

interface VenuePerformancesProps {
  venueName: string;
}

const PAGE_SIZE = 12;

export function VenuePerformances({ venueName }: VenuePerformancesProps) {
  const [after, setAfter] = useState<string | null>(null);
  const [prevEdges, setPrevEdges] = useState<any[]>([]);

  const [{ data, fetching }] = useQuery({
    query: VENUE_RUNS_QUERY,
    variables: { venueName, first: PAGE_SIZE, after },
  });

  const connection = data?.runsByVenue;
  const currentEdges = connection?.edges ?? [];
  const pageInfo = connection?.pageInfo;

  const displayEdges = after === null ? currentEdges : [...prevEdges, ...currentEdges];
  const runs = displayEdges.map((e: any) => e.node);

  function loadMore() {
    if (pageInfo?.endCursor) {
      setPrevEdges(displayEdges);
      setAfter(pageInfo.endCursor);
    }
  }

  if (!fetching && runs.length === 0) {
    return (
      <div>
        <h2 className="mb-3 text-xs uppercase tracking-widest text-curtn-muted">
          Productions
        </h2>
        <p className="text-sm text-curtn-muted">
          No productions at this venue yet.
        </p>
      </div>
    );
  }

  return (
    <div>
      <h2 className="mb-3 text-xs uppercase tracking-widest text-curtn-muted">
        Productions
      </h2>

      <div className="grid grid-cols-1 gap-3">
        {runs.map((run: any) => (
          <RunCard
            key={run.id}
            id={run.id}
            showTitle={run.show.title}
            performanceTypes={run.show.performanceTypes}
            companyName={run.productionCompany?.name}
            companySlug={run.productionCompany?.slug}
            imageUrl={run.show.imageUrl}
            startDate={run.startDate}
            endDate={run.endDate}
            averageRating={run.averageRating}
            reviewCount={run.reviewCount}
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
          className="mt-4 w-full rounded-lg border border-curtn-dark py-2.5 text-sm text-curtn-muted transition-colors hover:border-curtn-muted/50 hover:text-curtn-cream"
        >
          Load more productions
        </button>
      )}
    </div>
  );
}
