"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { useQuery } from "urql";
import Link from "next/link";
import { SINGLE_SHOW_QUERY } from "@/lib/graphql/shows";
import { RUN_REVIEWS_QUERY } from "@/lib/graphql/performances";
import { ShowHero } from "@/components/shows/ShowHero";
import { RunHero } from "@/components/runs/RunHero";
import { RunCard } from "@/components/runs/RunCard";
import { ShowingsList } from "@/components/performances/ShowingsList";
import { CreditsList } from "@/components/credits/CreditsList";
import { AddCreditForm } from "@/components/credits/AddCreditForm";
import { AddShowCreditForm } from "@/components/credits/AddShowCreditForm";
import { ReviewCard } from "@/components/reviews/ReviewCard";
import { WatchlistButton } from "@/components/watchlist/WatchlistButton";
import { Icon } from "@/components/icons/Icons";
import { useAuth } from "@/lib/auth/useAuth";
import { formatShowDate, formatShowTime } from "@/lib/format";

const REVIEW_PAGE_SIZE = 12;

export default function ShowDetailPage() {
  const params = useParams();
  const id = decodeURIComponent(params.id as string);
  const { isAuthenticated } = useAuth();

  const [{ data, fetching }, reexecuteShow] = useQuery({
    query: SINGLE_SHOW_QUERY,
    variables: { id },
  });

  const show = data?.singleShow;
  const runs = show?.runs?.edges?.map((e: any) => e.node) ?? [];
  const runCount = runs.length;
  const singleRun = runCount === 1 ? runs[0] : null;
  const performances = singleRun?.performances?.edges?.map((e: any) => e.node) ?? [];
  const perfCount = performances.length;
  const singlePerf = perfCount === 1 ? performances[0] : null;
  const creators = show?.creators?.edges?.map((e: any) => e.node) ?? [];

  // For reviews, use the single run's ID when in Scenario A or B
  const reviewRunId = singleRun?.id || null;

  const [reviewAfter, setReviewAfter] = useState<string | null>(null);
  const [allReviewEdges, setAllReviewEdges] = useState<any[]>([]);

  const [{ data: reviewData, fetching: reviewsFetching }, reexecuteReviews] =
    useQuery({
      query: RUN_REVIEWS_QUERY,
      variables: {
        runId: reviewRunId,
        first: REVIEW_PAGE_SIZE,
        after: reviewAfter,
      },
      pause: !reviewRunId,
    });

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

  const reviewConnection = reviewData?.reviewList;
  const reviewEdges = (reviewConnection?.edges ?? []).filter(
    (e: any) => e.node != null
  );
  const reviewPageInfo = reviewConnection?.pageInfo;
  const displayReviewEdges =
    reviewAfter === null ? reviewEdges : [...allReviewEdges, ...reviewEdges];

  function loadMoreReviews() {
    if (reviewPageInfo?.endCursor) {
      setAllReviewEdges(displayReviewEdges);
      setReviewAfter(reviewPageInfo.endCursor);
    }
  }

  function handleReviewDeleted() {
    setReviewAfter(null);
    setAllReviewEdges([]);
    reexecuteReviews({ requestPolicy: "network-only" });
  }

  function handleCreditAdded() {
    reexecuteShow({ requestPolicy: "network-only" });
  }

  // --- SCENARIO A: 1 run, 1 performance — fully combined page ---
  if (singleRun && singlePerf) {
    const company = singleRun.productionCompany;
    const venues = singleRun.venues || [];
    const isSoldOut =
      singlePerf.soldOut === true || singlePerf.soldOut === "true";

    return (
      <div className="px-6 py-8 max-w-2xl mx-auto space-y-8">
        <RunHero
          showTitle={show.title}
          showId={show.id}
          description={singleRun.description}
          showDescription={show.description}
          performanceTypes={show.performanceTypes}
          duration={show.duration}
          intermissions={singleRun.intermissions}
          languages={show.languages}
          imageUrl={show.imageUrl}
          creators={creators}
          companyName={company?.name}
          companySlug={company?.slug}
          venues={venues.map((v: any) => ({
            name: v.name,
            slug: v.slug,
            city: v.city,
          }))}
          startDate={singlePerf.date}
          endDate={null}
          averageRating={singleRun.averageRating}
          reviewCount={singleRun.reviewCount}
        />

        {/* Single performance details inline */}
        <div className="flex items-center gap-3 rounded-lg border border-curtn-dark/50 bg-curtn-surface px-4 py-3">
          <div className="flex-1 flex items-center gap-3 text-sm">
            <span className="flex items-center gap-1 text-curtn-cream">
              <Icon name="calendar" size={14} />
              {formatShowDate(singlePerf.date)}
            </span>
            {singlePerf.time && (
              <span className="text-curtn-muted">
                {formatShowTime(singlePerf.time)}
              </span>
            )}
            {isSoldOut && (
              <span className="text-xs text-curtn-muted/50">Sold Out</span>
            )}
          </div>
          {!isSoldOut && singlePerf.ticketUrl && (
            <a
              href={singlePerf.ticketUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 rounded-full border border-curtn-coral/30 px-3 py-1 text-xs text-curtn-coral transition-colors hover:bg-curtn-coral/10"
            >
              <Icon name="ticket" size={12} />
              Tickets
            </a>
          )}
        </div>

        <WatchlistButton
          showId={show.id}
          initialIsOnWatchlist={show.isOnMyWatchlist ?? false}
          initialWatchlistCount={show.watchlistCount ?? 0}
        />

        <Link
          href={`/log?run=${singleRun.id}`}
          className="block w-full rounded-lg bg-curtn-coral py-3 text-center text-sm font-semibold text-white transition-colors hover:bg-curtn-red"
        >
          Log This Show
        </Link>

        <CreditsList cast={singleRun.cast ?? []} crew={singleRun.crew ?? []} />

        {isAuthenticated && (
          <div className="rounded-lg border border-curtn-dark/50 bg-curtn-surface p-4 space-y-6">
            <AddShowCreditForm showId={show.id} onAdded={handleCreditAdded} />
            <AddCreditForm runId={singleRun.id} onAdded={handleCreditAdded} />
          </div>
        )}

        <ReviewsSection
          edges={displayReviewEdges}
          fetching={reviewsFetching}
          pageInfo={reviewPageInfo}
          onLoadMore={loadMoreReviews}
          onDeleted={handleReviewDeleted}
        />
      </div>
    );
  }

  // --- SCENARIO B: 1 run, multiple performances — combined show+run, performance list ---
  if (singleRun) {
    const company = singleRun.productionCompany;
    const venues = singleRun.venues || [];
    const upcomingShowings =
      singleRun.upcomingPerformances?.edges?.map((e: any) => e.node) ?? [];
    const allShowings = performances;
    const pastShowings = allShowings.filter(
      (s: any) => new Date(s.date) <= new Date()
    );

    return (
      <div className="px-6 py-8 max-w-2xl mx-auto space-y-8">
        <RunHero
          showTitle={show.title}
          showId={show.id}
          description={singleRun.description}
          showDescription={show.description}
          performanceTypes={show.performanceTypes}
          duration={show.duration}
          intermissions={singleRun.intermissions}
          languages={show.languages}
          imageUrl={show.imageUrl}
          creators={creators}
          companyName={company?.name}
          companySlug={company?.slug}
          venues={venues.map((v: any) => ({
            name: v.name,
            slug: v.slug,
            city: v.city,
          }))}
          startDate={singleRun.startDate}
          endDate={singleRun.endDate}
          averageRating={singleRun.averageRating}
          reviewCount={singleRun.reviewCount}
        />

        <WatchlistButton
          showId={show.id}
          initialIsOnWatchlist={show.isOnMyWatchlist ?? false}
          initialWatchlistCount={show.watchlistCount ?? 0}
        />

        {upcomingShowings.length > 0 && (
          <ShowingsList showings={upcomingShowings} label="Upcoming Shows" />
        )}

        <Link
          href={`/log?run=${singleRun.id}`}
          className="block w-full rounded-lg bg-curtn-coral py-3 text-center text-sm font-semibold text-white transition-colors hover:bg-curtn-red"
        >
          Log This Show
        </Link>

        <CreditsList cast={singleRun.cast ?? []} crew={singleRun.crew ?? []} />

        {isAuthenticated && (
          <div className="rounded-lg border border-curtn-dark/50 bg-curtn-surface p-4 space-y-6">
            <AddShowCreditForm showId={show.id} onAdded={handleCreditAdded} />
            <AddCreditForm runId={singleRun.id} onAdded={handleCreditAdded} />
          </div>
        )}

        <ReviewsSection
          edges={displayReviewEdges}
          fetching={reviewsFetching}
          pageInfo={reviewPageInfo}
          onLoadMore={loadMoreReviews}
          onDeleted={handleReviewDeleted}
        />

        {pastShowings.length > 0 && (
          <ShowingsList showings={pastShowings} label="Past Shows" />
        )}
      </div>
    );
  }

  // --- SCENARIO C: multiple runs — show info + run list ---
  return (
    <div className="px-6 py-8 max-w-2xl mx-auto space-y-8">
      <ShowHero
        title={show.title}
        description={show.description}
        performanceTypes={show.performanceTypes}
        duration={show.duration}
        languages={show.languages}
        imageUrl={show.imageUrl}
        creators={creators}
        averageRating={show.averageRating}
        reviewCount={show.reviewCount}
      />

      <WatchlistButton
        showId={show.id}
        initialIsOnWatchlist={show.isOnMyWatchlist ?? false}
        initialWatchlistCount={show.watchlistCount ?? 0}
      />

      {isAuthenticated && (
        <div className="rounded-lg border border-curtn-dark/50 bg-curtn-surface p-4">
          <AddShowCreditForm showId={show.id} onAdded={handleCreditAdded} />
        </div>
      )}

      <div>
        <h2 className="mb-3 text-xs uppercase tracking-widest text-curtn-muted">
          Productions ({runs.length})
        </h2>
        <div className="space-y-3">
          {runs.map((run: any) => (
            <RunCard
              key={run.id}
              id={run.id}
              showTitle={run.effectiveTitle || show.title}
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
    </div>
  );
}

// --- Shared Reviews Section ---
function ReviewsSection({
  edges,
  fetching,
  pageInfo,
  onLoadMore,
  onDeleted,
}: {
  edges: any[];
  fetching: boolean;
  pageInfo: any;
  onLoadMore: () => void;
  onDeleted: () => void;
}) {
  return (
    <div>
      <h2 className="mb-3 text-xs uppercase tracking-widest text-curtn-muted">
        Reviews
        {edges.length > 0 &&
          ` (${edges.length}${pageInfo?.hasNextPage ? "+" : ""})`}
      </h2>

      {!fetching && edges.length === 0 && (
        <p className="text-sm text-curtn-muted">No reviews yet.</p>
      )}

      <div className="space-y-3">
        {edges.map((edge: any) => (
          <ReviewCard
            key={edge.node.id}
            review={edge.node}
            onDeleted={onDeleted}
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
          onClick={onLoadMore}
          className="mt-4 w-full rounded-lg border border-curtn-dark py-2.5 text-sm text-curtn-muted transition-colors hover:border-curtn-muted/50 hover:text-curtn-cream cursor-pointer"
        >
          Load more reviews
        </button>
      )}
    </div>
  );
}
