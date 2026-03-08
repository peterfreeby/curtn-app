"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { useQuery } from "urql";
import Link from "next/link";
import { SINGLE_RUN_QUERY } from "@/lib/graphql/runs";
import { RUN_REVIEWS_QUERY } from "@/lib/graphql/performances";
import { RunHero } from "@/components/runs/RunHero";
import { ShowingsList } from "@/components/performances/ShowingsList";
import { CreditsList } from "@/components/credits/CreditsList";
import { AddCreditForm } from "@/components/credits/AddCreditForm";
import { AddShowCreditForm } from "@/components/credits/AddShowCreditForm";
import { ReviewCard } from "@/components/reviews/ReviewCard";
import { Icon } from "@/components/icons/Icons";
import { useAuth } from "@/lib/auth/useAuth";
import { formatShowDate, formatShowTime } from "@/lib/format";

const REVIEW_PAGE_SIZE = 12;

export default function RunDetailPage() {
  const params = useParams();
  const id = decodeURIComponent(params.id as string);
  const { isAuthenticated } = useAuth();

  const [{ data, fetching }, reexecuteRun] = useQuery({
    query: SINGLE_RUN_QUERY,
    variables: { id },
  });

  const [reviewAfter, setReviewAfter] = useState<string | null>(null);
  const [allReviewEdges, setAllReviewEdges] = useState<any[]>([]);

  const [{ data: reviewData, fetching: reviewsFetching }, reexecuteReviews] = useQuery({
    query: RUN_REVIEWS_QUERY,
    variables: { runId: id, first: REVIEW_PAGE_SIZE, after: reviewAfter },
  });

  const run = data?.singleRun;

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

  if (!run) {
    return (
      <div className="px-6 py-8 max-w-2xl mx-auto">
        <p className="text-curtn-muted text-sm">Run not found.</p>
      </div>
    );
  }

  const show = run.show;
  const company = run.productionCompany;
  const creators = show?.creators?.edges?.map((e: any) => e.node) ?? [];
  const heroImage = run.imageUrl || show?.imageUrl || null;
  const allShowings = run.performances?.edges?.map((e: any) => e.node) ?? [];
  const upcomingShowings = run.upcomingPerformances?.edges?.map((e: any) => e.node) ?? [];
  const pastShowings = allShowings.filter((s: any) => new Date(s.date) <= new Date());
  const singlePerf = allShowings.length === 1 ? allShowings[0] : null;

  const reviewConnection = reviewData?.reviewList;
  const reviewEdges = (reviewConnection?.edges ?? []).filter((e: any) => e.node != null);
  const reviewPageInfo = reviewConnection?.pageInfo;
  const displayReviewEdges = reviewAfter === null ? reviewEdges : [...allReviewEdges, ...reviewEdges];

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
    reexecuteRun({ requestPolicy: "network-only" });
  }

  // --- Single performance: absorb into run page ---
  if (singlePerf) {
    const isSoldOut = singlePerf.soldOut === true || singlePerf.soldOut === "true";

    return (
      <div className="px-6 py-8 max-w-2xl mx-auto space-y-8">
        <RunHero
          showTitle={show.title}
          showId={show.id}
          description={run.description}
          showDescription={show.description}
          performanceTypes={show.performanceTypes}
          duration={show.duration}
          intermissions={run.intermissions}
          languages={show.languages}
          imageUrl={heroImage}
          creators={creators}
          companyName={company?.name}
          companySlug={company?.slug}
          venues={run.venues.map((v: any) => ({ name: v.name, slug: v.slug, city: v.city }))}
          startDate={singlePerf.date}
          endDate={null}
          averageRating={run.averageRating}
          reviewCount={run.reviewCount}
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

        <Link
          href={`/log?run=${id}`}
          className="block w-full rounded-lg bg-curtn-coral py-3 text-center text-sm font-semibold text-white transition-colors hover:bg-curtn-red"
        >
          Log This Show
        </Link>

        <CreditsList cast={run.cast ?? []} crew={run.crew ?? []} />

        {isAuthenticated && (
          <div className="rounded-lg border border-curtn-dark/50 bg-curtn-surface p-4 space-y-6">
            <AddShowCreditForm showId={show.id} onAdded={handleCreditAdded} />
            <AddCreditForm runId={id} onAdded={handleCreditAdded} />
          </div>
        )}

        {/* Reviews */}
        <div>
          <h2 className="mb-3 text-xs uppercase tracking-widest text-curtn-muted">
            Reviews{displayReviewEdges.length > 0 && ` (${displayReviewEdges.length}${reviewPageInfo?.hasNextPage ? "+" : ""})`}
          </h2>
          {!reviewsFetching && displayReviewEdges.length === 0 && (
            <p className="text-sm text-curtn-muted">No reviews yet.</p>
          )}
          <div className="space-y-3">
            {displayReviewEdges.map((edge: any) => (
              <ReviewCard key={edge.node.id} review={edge.node} onDeleted={handleReviewDeleted} />
            ))}
          </div>
          {reviewsFetching && (
            <div className="mt-3 flex justify-center">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-curtn-muted/30 border-t-curtn-coral" />
            </div>
          )}
          {!reviewsFetching && reviewPageInfo?.hasNextPage && (
            <button type="button" onClick={loadMoreReviews} className="mt-4 w-full rounded-lg border border-curtn-dark py-2.5 text-sm text-curtn-muted transition-colors hover:border-curtn-muted/50 hover:text-curtn-cream cursor-pointer">
              Load more reviews
            </button>
          )}
        </div>
      </div>
    );
  }

  // --- Multiple performances: show listings ---
  return (
    <div className="px-6 py-8 max-w-2xl mx-auto space-y-8">
      <RunHero
        showTitle={show.title}
        showId={show.id}
        description={run.description}
        showDescription={show.description}
        performanceTypes={show.performanceTypes}
        duration={show.duration}
        intermissions={run.intermissions}
        languages={show.languages}
        imageUrl={heroImage}
        creators={creators}
        companyName={company?.name}
        companySlug={company?.slug}
        venues={run.venues.map((v: any) => ({ name: v.name, slug: v.slug, city: v.city }))}
        startDate={run.startDate}
        endDate={run.endDate}
        averageRating={run.averageRating}
        reviewCount={run.reviewCount}
      />

      {upcomingShowings.length > 0 && (
        <ShowingsList showings={upcomingShowings} label="Upcoming Shows" />
      )}

      <Link
        href={`/log?run=${id}`}
        className="block w-full rounded-lg bg-curtn-coral py-3 text-center text-sm font-semibold text-white transition-colors hover:bg-curtn-red"
      >
        Log This Show
      </Link>

      <CreditsList cast={run.cast ?? []} crew={run.crew ?? []} />

      {isAuthenticated && (
        <div className="rounded-lg border border-curtn-dark/50 bg-curtn-surface p-4 space-y-6">
          <AddShowCreditForm showId={show.id} onAdded={handleCreditAdded} />
          <AddCreditForm runId={id} onAdded={handleCreditAdded} />
        </div>
      )}

      {/* Reviews */}
      <div>
        <h2 className="mb-3 text-xs uppercase tracking-widest text-curtn-muted">
          Reviews{displayReviewEdges.length > 0 && ` (${displayReviewEdges.length}${reviewPageInfo?.hasNextPage ? "+" : ""})`}
        </h2>
        {!reviewsFetching && displayReviewEdges.length === 0 && (
          <p className="text-sm text-curtn-muted">No reviews yet.</p>
        )}
        <div className="space-y-3">
          {displayReviewEdges.map((edge: any) => (
            <ReviewCard key={edge.node.id} review={edge.node} onDeleted={handleReviewDeleted} />
          ))}
        </div>
        {reviewsFetching && (
          <div className="mt-3 flex justify-center">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-curtn-muted/30 border-t-curtn-coral" />
          </div>
        )}
        {!reviewsFetching && reviewPageInfo?.hasNextPage && (
          <button type="button" onClick={loadMoreReviews} className="mt-4 w-full rounded-lg border border-curtn-dark py-2.5 text-sm text-curtn-muted transition-colors hover:border-curtn-muted/50 hover:text-curtn-cream cursor-pointer">
            Load more reviews
          </button>
        )}
      </div>

      {pastShowings.length > 0 && (
        <ShowingsList showings={pastShowings} label="Past Shows" />
      )}
    </div>
  );
}
