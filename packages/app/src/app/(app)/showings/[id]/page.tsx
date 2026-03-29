"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { useQuery } from "urql";
import Link from "next/link";
import { SINGLE_PERFORMANCE_QUERY, RUN_REVIEWS_QUERY } from "@/lib/graphql/performances";
import { DetailBreadcrumb } from "@/components/nav/DetailBreadcrumb";
import { CreditsList } from "@/components/credits/CreditsList";
import { ReviewCard } from "@/components/reviews/ReviewCard";
import { Icon } from "@/components/icons/Icons";
import { useAuth } from "@/lib/auth/useAuth";
import { formatShowDate, formatShowTime } from "@/lib/format";

const REVIEW_PAGE_SIZE = 12;

function ReviewFilters({
  followedOnly,
  onFollowedChange,
  reviewScope,
  onScopeChange,
  isAuthenticated,
}: {
  followedOnly: boolean;
  onFollowedChange: (v: boolean) => void;
  reviewScope: "performance" | "run" | "show";
  onScopeChange: (v: "performance" | "run" | "show") => void;
  isAuthenticated: boolean;
}) {
  return (
    <div className="flex items-center gap-3 flex-wrap">
      {isAuthenticated && (
        <div className="flex rounded-lg border border-curtn-dark overflow-hidden text-xs">
          <button
            type="button"
            onClick={() => onFollowedChange(false)}
            className={`px-2.5 py-1 transition-colors cursor-pointer ${!followedOnly ? "bg-curtn-dark text-curtn-cream" : "text-curtn-muted hover:text-curtn-cream"}`}
          >
            All
          </button>
          <button
            type="button"
            onClick={() => onFollowedChange(true)}
            className={`px-2.5 py-1 transition-colors cursor-pointer ${followedOnly ? "bg-curtn-dark text-curtn-cream" : "text-curtn-muted hover:text-curtn-cream"}`}
          >
            Friends
          </button>
        </div>
      )}
      <div className="flex rounded-lg border border-curtn-dark overflow-hidden text-xs">
        <button
          type="button"
          onClick={() => onScopeChange("performance")}
          className={`px-2.5 py-1 transition-colors cursor-pointer ${reviewScope === "performance" ? "bg-curtn-dark text-curtn-cream" : "text-curtn-muted hover:text-curtn-cream"}`}
        >
          This Date
        </button>
        <button
          type="button"
          onClick={() => onScopeChange("run")}
          className={`px-2.5 py-1 transition-colors cursor-pointer ${reviewScope === "run" ? "bg-curtn-dark text-curtn-cream" : "text-curtn-muted hover:text-curtn-cream"}`}
        >
          This Run
        </button>
        <button
          type="button"
          onClick={() => onScopeChange("show")}
          className={`px-2.5 py-1 transition-colors cursor-pointer ${reviewScope === "show" ? "bg-curtn-dark text-curtn-cream" : "text-curtn-muted hover:text-curtn-cream"}`}
        >
          All Productions
        </button>
      </div>
    </div>
  );
}

export default function PerformanceDetailPage() {
  const params = useParams();
  const id = decodeURIComponent(params.id as string);
  const { isAuthenticated } = useAuth();

  const [{ data, fetching }] = useQuery({
    query: SINGLE_PERFORMANCE_QUERY,
    variables: { id },
  });

  const [reviewAfter, setReviewAfter] = useState<string | null>(null);
  const [allReviewEdges, setAllReviewEdges] = useState<any[]>([]);
  const [followedOnly, setFollowedOnly] = useState(false);
  const [reviewScope, setReviewScope] = useState<"performance" | "run" | "show">("performance");

  const perf = data?.singlePerformance;
  const run = perf?.run;
  const show = run?.show;

  const reviewVariables = {
    ...(reviewScope === "performance"
      ? { performance: id }
      : reviewScope === "run"
        ? { runId: run?.id }
        : { showId: show?.id }),
    first: REVIEW_PAGE_SIZE,
    after: reviewAfter,
    followedOnly: followedOnly || undefined,
  };

  const [{ data: reviewData, fetching: reviewsFetching }, reexecuteReviews] = useQuery({
    query: RUN_REVIEWS_QUERY,
    variables: reviewVariables,
    pause: !perf,
  });

  function handleFilterChange(v: boolean) {
    setFollowedOnly(v);
    setReviewAfter(null);
    setAllReviewEdges([]);
  }

  function handleScopeChange(v: "performance" | "run" | "show") {
    setReviewScope(v);
    setReviewAfter(null);
    setAllReviewEdges([]);
  }

  if (fetching) {
    return (
      <div className="animate-pulse">
        <div className="h-10 bg-curtn-surface" />
        <div className="px-6 py-8 max-w-[var(--content-width)] mx-auto space-y-4">
          <div className="h-8 w-3/4 bg-curtn-dark/60" />
          <div className="h-4 w-1/2 bg-curtn-dark/60" />
          <div className="h-4 w-1/3 bg-curtn-dark/60" />
        </div>
      </div>
    );
  }

  if (!perf || !run || !show) {
    return (
      <div className="px-6 py-8 max-w-[var(--content-width)] mx-auto">
        <div className="empty-state">
          <p className="font-display text-base font-bold uppercase mb-1.5 text-curtn-cream">Performance Not Found</p>
          <p className="text-xs text-curtn-muted max-w-[260px] mx-auto">This showing may have been removed.</p>
        </div>
      </div>
    );
  }

  const company = run.productionCompany;
  const venue = perf.venue || run.venues?.[0];
  const isSoldOut = perf.soldOut === true || perf.soldOut === "true";
  const dateStr = formatShowDate(perf.date);
  const timeStr = perf.time ? formatShowTime(perf.time) : null;

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

  // Build breadcrumb
  const runLabel = run.title || company?.name || run.venues?.[0]?.name || "Production";
  const breadcrumbLevels = [
    { label: show.title, href: `/performances/${encodeURIComponent(show.id)}` },
    { label: runLabel, href: `/runs/${encodeURIComponent(run.id)}` },
    { label: `${dateStr}${timeStr ? ` · ${timeStr}` : ""}` },
  ];

  return (
    <div className="relative">
      <DetailBreadcrumb levels={breadcrumbLevels} />

      <div className="px-6 py-8 max-w-[var(--content-width)] mx-auto space-y-8">
        {/* Hero */}
        <div className="relative">
          <h1 className="font-display text-2xl font-bold text-curtn-cream leading-tight">
            {show.title}
          </h1>
          <div className="mt-2 space-y-1 text-sm text-curtn-muted">
            <p>{dateStr}{timeStr ? ` · ${timeStr}` : ""}</p>
            {venue && <p>{venue.name}{venue.city ? `, ${venue.city}` : ""}</p>}
            {company && <p>{company.name}</p>}
          </div>
          {isSoldOut && (
            <span className="inline-block mt-2 badge badge-muted">Sold Out</span>
          )}
        </div>

        {/* Ticket link */}
        {!isSoldOut && perf.ticketUrl && (
          <a
            href={perf.ticketUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 border border-curtn-coral/30 px-4 py-2.5 text-sm text-curtn-coral transition-colors hover:bg-curtn-coral/10"
          >
            <Icon name="ticket" size={14} />
            Get Tickets
          </a>
        )}

        {/* Log CTA */}
        <Link
          href={`/log?run=${run.id}`}
          className="block w-full dog-ear dog-ear-dark bg-curtn-coral py-3 text-center font-display text-sm font-bold uppercase tracking-wide text-curtn-deep transition-colors hover:bg-curtn-red"
        >
          Log This Show
        </Link>

        {/* Credits */}
        {((perf.effectiveCast?.length ?? 0) > 0 || (perf.effectiveCrew?.length ?? 0) > 0) && (
          <CreditsList
            cast={(perf.effectiveCast ?? []).map((c: any) => ({
              id: c.id,
              role: c.role,
              person: c.person,
            }))}
            crew={(perf.effectiveCrew ?? []).map((c: any) => ({
              id: c.id,
              role: c.role,
              person: c.person,
            }))}
          />
        )}

        {/* Description */}
        {perf.effectiveDescription && (
          <div className="relative">
            <h2 className="mb-2 text-xs uppercase tracking-widest text-curtn-muted">About</h2>
            <p className="text-sm text-curtn-cream/80 leading-relaxed">
              {perf.effectiveDescription}
            </p>
          </div>
        )}

        {/* Reviews */}
        <div className="relative">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs uppercase tracking-widest text-curtn-muted">
              Reviews{displayReviewEdges.length > 0 && ` (${displayReviewEdges.length}${reviewPageInfo?.hasNextPage ? "+" : ""})`}
            </h2>
            <ReviewFilters
              followedOnly={followedOnly}
              onFollowedChange={handleFilterChange}
              reviewScope={reviewScope}
              onScopeChange={handleScopeChange}
              isAuthenticated={isAuthenticated}
            />
          </div>

          {!reviewsFetching && displayReviewEdges.length === 0 && (
            <div className="empty-state">
              <p className="font-display text-base font-bold uppercase mb-1.5 text-curtn-cream">No Reviews Yet</p>
              <p className="text-xs text-curtn-muted max-w-[260px] mx-auto">Be the first to share your thoughts about this performance.</p>
            </div>
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
            <button
              type="button"
              onClick={loadMoreReviews}
              className="mt-4 w-full border border-curtn-dark py-2.5 text-sm text-curtn-muted transition-colors hover:border-curtn-muted/50 hover:text-curtn-cream cursor-pointer"
            >
              Load more reviews
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
