"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { useNowViewing } from "@/lib/NowViewingContext";
import { useQuery } from "urql";
import Link from "next/link";
import { SINGLE_RUN_QUERY } from "@/lib/graphql/runs";
import { RUN_REVIEWS_QUERY } from "@/lib/graphql/performances";
import { RunHero } from "@/components/runs/RunHero";
import { ShowingsList } from "@/components/performances/ShowingsList";
import { CreditsList } from "@/components/credits/CreditsList";
import { ReviewCard } from "@/components/reviews/ReviewCard";
import { Icon } from "@/components/icons/Icons";
import { useAuth } from "@/lib/auth/useAuth";
import { AddToListButton } from "@/components/lists/AddToListButton";
import { Button } from "@/components/Button";
import { InlineEditor } from "@/components/admin/InlineEditor";
import { BatchPerformanceCreator } from "@/components/admin/BatchPerformanceCreator";
import { DetailBreadcrumb } from "@/components/nav/DetailBreadcrumb";
import { formatShowDate, formatShowTime } from "@/lib/format";

function decodeId(globalId: string): string {
  return atob(globalId).split(":")[1];
}

function ReviewFilters({
  followedOnly,
  onFollowedChange,
  reviewScope,
  onScopeChange,
  isAuthenticated,
}: {
  followedOnly: boolean;
  onFollowedChange: (v: boolean) => void;
  reviewScope: "run" | "show";
  onScopeChange: (v: "run" | "show") => void;
  isAuthenticated: boolean;
}) {
  return (
    <div className="flex items-center gap-3 flex-wrap">
      {isAuthenticated && (
        <div className="flex rounded-lg border border-curtn-dark overflow-hidden text-xs">
          <button
            type="button"
            onClick={() => onFollowedChange(false)}
            className={`px-2.5 py-1 transition-colors cursor-pointer ${
              !followedOnly
                ? "bg-curtn-dark text-curtn-cream"
                : "text-curtn-muted hover:text-curtn-cream"
            }`}
          >
            All
          </button>
          <button
            type="button"
            onClick={() => onFollowedChange(true)}
            className={`px-2.5 py-1 transition-colors cursor-pointer ${
              followedOnly
                ? "bg-curtn-dark text-curtn-cream"
                : "text-curtn-muted hover:text-curtn-cream"
            }`}
          >
            Friends
          </button>
        </div>
      )}
      <div className="flex rounded-lg border border-curtn-dark overflow-hidden text-xs">
        <button
          type="button"
          onClick={() => onScopeChange("run")}
          className={`px-2.5 py-1 transition-colors cursor-pointer ${
            reviewScope === "run"
              ? "bg-curtn-dark text-curtn-cream"
              : "text-curtn-muted hover:text-curtn-cream"
          }`}
        >
          This Run
        </button>
        <button
          type="button"
          onClick={() => onScopeChange("show")}
          className={`px-2.5 py-1 transition-colors cursor-pointer ${
            reviewScope === "show"
              ? "bg-curtn-dark text-curtn-cream"
              : "text-curtn-muted hover:text-curtn-cream"
          }`}
        >
          All Productions
        </button>
      </div>
    </div>
  );
}

const REVIEW_PAGE_SIZE = 12;

export default function RunDetailPage() {
  const params = useParams();
  const id = decodeURIComponent(params.id as string);
  const { isAuthenticated, user } = useAuth();
  const isAdmin = !!user?.isAdmin;
  const [editing, setEditing] = useState(false);
  const [batchCreating, setBatchCreating] = useState(false);

  const [{ data, fetching }, reexecuteRun] = useQuery({
    query: SINGLE_RUN_QUERY,
    variables: { id },
  });

  const [reviewAfter, setReviewAfter] = useState<string | null>(null);
  const [allReviewEdges, setAllReviewEdges] = useState<any[]>([]);
  const [followedOnly, setFollowedOnly] = useState(false);
  const [reviewScope, setReviewScope] = useState<"run" | "show">("run");

  const reviewVariables = {
    ...(reviewScope === "run" ? { runId: id } : { showId: data?.singleRun?.show?.id }),
    first: REVIEW_PAGE_SIZE,
    after: reviewAfter,
    followedOnly: followedOnly || undefined,
  };

  const [{ data: reviewData, fetching: reviewsFetching }, reexecuteReviews] = useQuery({
    query: RUN_REVIEWS_QUERY,
    variables: reviewVariables,
  });

  const { setNowViewing } = useNowViewing();
  const run = data?.singleRun;

  useEffect(() => {
    if (run?.show) {
      const runDate = run.startDate ? new Date(run.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : null;
      const sub = run.title || run.productionCompany?.name || run.venues?.[0]?.name || runDate || null;
      setNowViewing({
        title: run.show.title,
        subtitle: sub,
        posterUrl: run.posterUrl || run.imageUrl || run.show.posterUrl || run.show.imageUrl,
        showId: run.show.id,
        runId: run.id,
        isOnWatchlist: false,
        href: `/runs/${encodeURIComponent(id)}`,
        parentHref: `/performances/${encodeURIComponent(run.show.id)}`,
      });
    }
    return () => setNowViewing(null);
  }, [run?.show?.title, run?.posterUrl, run?.imageUrl, id, setNowViewing]);

  if (fetching) {
    return (
      <div className="px-4 sm:px-6 py-8 max-w-[var(--content-width)] mx-auto animate-pulse space-y-4">
        <div className="flex gap-1.5">
          <div className="h-4 w-14 bg-curtn-dark/60" />
          <div className="h-4 w-18 bg-curtn-dark/60" />
        </div>
        <div className="h-8 w-3/4 bg-curtn-dark/60" />
        <div className="h-4 w-1/3 bg-curtn-dark/60" />
        <div className="h-4 w-1/2 bg-curtn-dark/60" />
        <div className="mt-6 h-24 bg-curtn-dark/60" />
      </div>
    );
  }

  if (!run) {
    return (
      <div className="px-4 sm:px-6 py-8 max-w-[var(--content-width)] mx-auto">
        <div className="empty-state">
          <p className="font-display text-base font-bold uppercase mb-1.5 text-curtn-cream">Run Not Found</p>
          <p className="text-xs text-curtn-muted max-w-[260px] mx-auto">This production may have been removed.</p>
        </div>
      </div>
    );
  }

  const show = run.show;
  const company = run.productionCompany;
  const creators = show?.creators?.edges?.map((e: any) => e.node) ?? [];
  const heroImage = run.imageUrl || show?.imageUrl || null;
  const heroPoster = run.posterUrl || show?.posterUrl || null;
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

  function handleFilterChange(newFollowedOnly: boolean) {
    setFollowedOnly(newFollowedOnly);
    setReviewAfter(null);
    setAllReviewEdges([]);
  }

  function handleScopeChange(newScope: "run" | "show") {
    setReviewScope(newScope);
    setReviewAfter(null);
    setAllReviewEdges([]);
  }

  function handleCreditAdded() {
    reexecuteRun({ requestPolicy: "network-only" });
  }

  // --- Single performance: absorb into run page ---
  if (singlePerf) {
    const isSoldOut = singlePerf.soldOut === true || singlePerf.soldOut === "true";
    const dateObj = new Date(singlePerf.date);
    const day = dateObj.getDate().toString().padStart(2, "0");
    const month = dateObj.toLocaleString("en-US", { month: "short" });

    return (
      <div className="relative">
        <DetailBreadcrumb levels={[
          { label: show.title, href: `/performances/${encodeURIComponent(show.id)}` },
          { label: run.title || company?.name || run.venues?.[0]?.name || "Production" },
        ]} />
        <div className="px-4 sm:px-6 py-8 max-w-[var(--content-width)] mx-auto space-y-8">
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
          posterUrl={heroPoster}
          creators={creators}
          companyName={company?.name}
          companySlug={company?.slug}
          venues={run.venues.map((v: any) => ({ name: v.name, slug: v.slug, city: v.city }))}
          startDate={singlePerf.date}
          endDate={null}
          averageRating={run.averageRating}
          reviewCount={run.reviewCount}
        />

        {isAuthenticated && (
          <AddToListButton listType="runs" itemId={id} />
        )}

        {/* Single performance — ticket card */}
        <div className="card-ticket">
          <div className={`ticket-stub ${isSoldOut ? "!bg-curtn-muted" : ""}`}>
            <div className="ticket-date">{day}</div>
            <div className="ticket-month">{month}</div>
          </div>
          <div className="ticket-body flex items-center justify-between">
            <div className="relative">
              <div className="ticket-title text-curtn-cream">
                {formatShowDate(singlePerf.date)}
              </div>
              <div className="ticket-time">
                {singlePerf.time && formatShowTime(singlePerf.time)}
                {isSoldOut && <span className="badge badge-muted ml-2">Sold Out</span>}
              </div>
            </div>
            {!isSoldOut && singlePerf.ticketUrl && (
              <a
                href={singlePerf.ticketUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 border border-curtn-coral/30 px-3 py-1.5 text-xs text-curtn-coral transition-colors hover:bg-curtn-coral/10"
              >
                <Icon name="ticket" size={12} />
                Tickets
              </a>
            )}
          </div>
        </div>

        <Link
          href={`/log?run=${id}`}
          className="block w-full dog-ear dog-ear-dark bg-curtn-coral py-3 text-center font-display text-sm font-bold uppercase tracking-wide text-curtn-deep transition-colors hover:bg-curtn-red"
        >
          Log This Show
        </Link>

        <CreditsList cast={run.cast ?? []} crew={run.crew ?? []} />

        {isAdmin && !editing && !batchCreating && (
          <div className="flex gap-2">
            <Button variant="tertiary" size="sm" icon="pencil" onClick={() => setEditing(true)}>
              Edit Run
            </Button>
            <Button variant="tertiary" size="sm" icon="plus" onClick={() => setBatchCreating(true)}>
              Add Performances
            </Button>
          </div>
        )}
        {editing && (
          <InlineEditor
            entityType="run"
            entityId={decodeId(id)}
            runId={id}
            venueId={run.venues?.[0]?.id}
            showId={show.id}
            effectiveCast={(run.cast ?? []).map((c: any) => ({ id: c.id, role: c.role, person: c.person }))}
            effectiveCrew={(run.crew ?? []).map((c: any) => ({ id: c.id, role: c.role, person: c.person }))}
            initialValues={{
              title: run.title || "",
              description: run.description || "",
              intermissions: run.intermissions ?? 0,
              startDate: run.startDate || "",
              endDate: run.endDate || "",
              posterUrl: run.posterUrl || "",
              imageUrl: run.imageUrl || "",
            }}
            onSaved={() => { setEditing(false); window.location.reload(); }}
            onCancel={() => setEditing(false)}
          />
        )}
        {batchCreating && (
          <BatchPerformanceCreator
            runId={id}
            venueId={run.venues?.[0]?.id || ""}
            startDate={run.startDate}
            endDate={run.endDate}
            onCreated={() => { setBatchCreating(false); window.location.reload(); }}
            onCancel={() => setBatchCreating(false)}
          />
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
              <p className="text-xs text-curtn-muted max-w-[260px] mx-auto">Be the first to share your thoughts about this production.</p>
              <div className="mt-4 flex flex-col sm:flex-row items-center justify-center gap-2">
                <Button variant="primary" size="sm" href={`/log?run=${id}`}>
                  Write a Review
                </Button>
                <Button variant="tertiary" size="sm" href={`/performances/${encodeURIComponent(show.id)}`}>
                  View Other Productions
                </Button>
              </div>
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
            <button type="button" onClick={loadMoreReviews} className="mt-4 w-full border border-curtn-dark py-2.5 text-sm text-curtn-muted transition-colors hover:border-curtn-muted/50 hover:text-curtn-cream cursor-pointer">
              Load more reviews
            </button>
          )}
        </div>
      </div>
      </div>
    );
  }

  // --- Multiple performances: show listings ---
  return (
    <div className="relative">
      <DetailBreadcrumb levels={[
        { label: show.title, href: `/performances/${encodeURIComponent(show.id)}` },
        { label: run.title || company?.name || run.venues?.[0]?.name || "Production" },
      ]} />
      <div className="px-4 sm:px-6 py-8 max-w-[var(--content-width)] mx-auto space-y-8">
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

      {isAuthenticated && <AddToListButton listType="runs" itemId={id} />
      }

      {upcomingShowings.length > 0 && (
        <ShowingsList showings={upcomingShowings} label="Upcoming Shows" />
      )}

      <Link
        href={`/log?run=${id}`}
        className="block w-full dog-ear dog-ear-dark bg-curtn-coral py-3 text-center font-display text-sm font-bold uppercase tracking-wide text-curtn-deep transition-colors hover:bg-curtn-red"
      >
        Log This Show
      </Link>

      <CreditsList cast={run.cast ?? []} crew={run.crew ?? []} />

      {isAdmin && !editing && !batchCreating && (
        <div className="flex gap-2">
          <Button variant="tertiary" size="sm" icon="pencil" onClick={() => setEditing(true)}>
            Edit Run
          </Button>
          <Button variant="tertiary" size="sm" icon="plus" onClick={() => setBatchCreating(true)}>
            Add Performances
          </Button>
        </div>
      )}
      {editing && (
        <InlineEditor
          entityType="run"
          entityId={decodeId(id)}
          runId={id}
          venueId={run.venues?.[0]?.id}
          showId={show.id}
          effectiveCast={(run.cast ?? []).map((c: any) => ({ id: c.id, role: c.role, person: c.person }))}
          effectiveCrew={(run.crew ?? []).map((c: any) => ({ id: c.id, role: c.role, person: c.person }))}
          initialValues={{
            title: run.title || "",
            description: run.description || "",
            intermissions: run.intermissions ?? 0,
            startDate: run.startDate || "",
            endDate: run.endDate || "",
              posterUrl: run.posterUrl || "",
              imageUrl: run.imageUrl || "",
          }}
          onSaved={() => { setEditing(false); window.location.reload(); }}
          onCancel={() => setEditing(false)}
        />
      )}
      {batchCreating && (
        <BatchPerformanceCreator
          runId={id}
          venueId={run.venues?.[0]?.id || ""}
          startDate={run.startDate}
          endDate={run.endDate}
          onCreated={() => { setBatchCreating(false); window.location.reload(); }}
          onCancel={() => setBatchCreating(false)}
        />
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
            <p className="text-xs text-curtn-muted max-w-[260px] mx-auto">Be the first to share your thoughts about this production.</p>
            <div className="mt-4 flex flex-col sm:flex-row items-center justify-center gap-2">
              <Button variant="primary" size="sm" href={`/log?run=${id}`}>
                Write a Review
              </Button>
              <Button variant="tertiary" size="sm" href={`/performances/${encodeURIComponent(show.id)}`}>
                View Other Productions
              </Button>
            </div>
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
          <button type="button" onClick={loadMoreReviews} className="mt-4 w-full border border-curtn-dark py-2.5 text-sm text-curtn-muted transition-colors hover:border-curtn-muted/50 hover:text-curtn-cream cursor-pointer">
            Load more reviews
          </button>
        )}
      </div>

      {pastShowings.length > 0 && (
        <ShowingsList showings={pastShowings} label="Past Shows" />
      )}
    </div>
    </div>
  );
}
