"use client";

import { useParams } from "next/navigation";
import { useQuery } from "urql";
import { SINGLE_SHOW_QUERY } from "@/lib/graphql/shows";
import { ShowHero } from "@/components/shows/ShowHero";
import { RunCard } from "@/components/runs/RunCard";
import { WatchlistButton } from "@/components/watchlist/WatchlistButton";

export default function ShowDetailPage() {
  const params = useParams();
  const id = decodeURIComponent(params.id as string);

  const [{ data, fetching }] = useQuery({
    query: SINGLE_SHOW_QUERY,
    variables: { id },
  });

  const show = data?.singleShow;

  if (fetching) {
    return (
      <div className="px-6 py-8 max-w-2xl mx-auto animate-pulse space-y-4">
        <div className="flex gap-1.5">
          <div className="h-4 w-14 rounded-full bg-curtn-dark/60" />
          <div className="h-4 w-18 rounded-full bg-curtn-dark/60" />
        </div>
        <div className="h-8 w-3/4 rounded bg-curtn-dark/60" />
        <div className="h-4 w-1/3 rounded bg-curtn-dark/60" />
        <div className="h-4 w-1/2 rounded bg-curtn-dark/60" />
        <div className="mt-6 h-24 rounded-lg bg-curtn-dark/60" />
      </div>
    );
  }

  if (!show) {
    return (
      <div className="px-6 py-8 max-w-2xl mx-auto">
        <p className="text-curtn-muted text-sm">Show not found.</p>
      </div>
    );
  }

  const runs = show.runs?.edges?.map((e: any) => e.node) ?? [];

  return (
    <div className="px-6 py-8 max-w-2xl mx-auto space-y-8">
      <ShowHero
        title={show.title}
        description={show.description}
        performanceTypes={show.performanceTypes}
        duration={show.duration}
        languages={show.languages}
        averageRating={show.averageRating}
        reviewCount={show.reviewCount}
      />

      <div className="mt-4">
        <WatchlistButton
          showId={show.id}
          initialIsOnWatchlist={show.isOnMyWatchlist ?? false}
          initialWatchlistCount={show.watchlistCount ?? 0}
        />
      </div>

      {runs.length > 0 && (
        <div>
          <h2 className="mb-3 text-xs uppercase tracking-widest text-curtn-muted">
            Productions ({runs.length})
          </h2>
          <div className="space-y-3">
            {runs.map((run: any) => (
              <RunCard
                key={run.id}
                id={run.id}
                showTitle={show.title}
                companyName={run.productionCompany?.name}
                companySlug={run.productionCompany?.slug}
                venueName={run.venues?.[0]?.name}
                venueCity={run.venues?.[0]?.city}
                startDate={run.startDate}
                endDate={run.endDate}
                averageRating={run.averageRating}
                reviewCount={run.reviewCount}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
