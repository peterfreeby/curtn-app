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
import { ReviewCard } from "@/components/reviews/ReviewCard";
import { WatchlistButton } from "@/components/watchlist/WatchlistButton";
import { AddToListButton } from "@/components/lists/AddToListButton";
import { DetailBreadcrumb } from "@/components/nav/DetailBreadcrumb";
import { Button } from "@/components/Button";
import { InlineEditor } from "@/components/admin/InlineEditor";
import { AddSiblingActions } from "@/components/admin/AddSiblingActions";
import { Icon } from "@/components/icons/Icons";
import { useAuth } from "@/lib/auth/useAuth";

function decodeId(globalId: string): string {
  return atob(globalId).split(":")[1];
}

const REVIEW_PAGE_SIZE = 12;

export default function ShowDetailPage() {
  const params = useParams();
  const id = decodeURIComponent(params.id as string);
  const { user } = useAuth();
  const isAdmin = !!user?.isAdmin;
  const [editing, setEditing] = useState<"show" | "run" | null>(null);

  const [{ data, fetching }] = useQuery({
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

  // Reviews: use runId for scenarios A/B, showId for scenario C
  const reviewRunId = singleRun?.id || null;
  const reviewShowId = !singleRun && show ? show.id : null;

  const [reviewAfter, setReviewAfter] = useState<string | null>(null);
  const [allReviewEdges, setAllReviewEdges] = useState<any[]>([]);
  const [followedOnly, setFollowedOnly] = useState(false);

  const [{ data: reviewData, fetching: reviewsFetching }, reexecuteReviews] =
    useQuery({
      query: RUN_REVIEWS_QUERY,
      variables: {
        ...(reviewRunId ? { runId: reviewRunId } : { showId: reviewShowId }),
        first: REVIEW_PAGE_SIZE,
        after: reviewAfter,
        followedOnly: followedOnly || undefined,
      },
      pause: !reviewRunId && !reviewShowId,
    });

  if (fetching) {
    return (
      <div className="px-6 py-8 max-w-[var(--content-width)] mx-auto animate-pulse space-y-4">
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

  if (!show) {
    return (
      <div className="px-6 py-8 max-w-[var(--content-width)] mx-auto">
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

  // --- SCENARIO A: 1 run, 1 performance — fully combined page ---
  if (singleRun && singlePerf) {
    const company = singleRun.productionCompany;
    const venues = singleRun.venues || [];
    const isSoldOut =
      singlePerf.soldOut === true || singlePerf.soldOut === "true";

    return (
      <div className="relative">
        <div className="px-6 py-8 max-w-[var(--content-width)] mx-auto space-y-8">
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
          posterUrl={show.posterUrl}
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
          performanceDate={singlePerf.date}
          performanceTime={singlePerf.time}
          ticketUrl={singlePerf.ticketUrl}
          soldOut={isSoldOut}
        />

        <div className="flex items-center gap-3">
          <WatchlistButton
            showId={show.id}
            initialIsOnWatchlist={show.isOnMyWatchlist ?? false}
            initialWatchlistCount={show.watchlistCount ?? 0}
          />
          <AddToListButton itemId={show.id} listType="shows" />
        </div>

        <Link
          href={`/log?run=${singleRun.id}`}
          className="block w-full dog-ear dog-ear-dark bg-curtn-coral py-3 text-center font-display text-sm font-bold uppercase tracking-wide text-curtn-deep transition-colors hover:bg-curtn-red"
        >
          Log This Show
        </Link>

        <CreditsList cast={singleRun.cast ?? []} crew={singleRun.crew ?? []} />

        {isAdmin && !editing && (
          <div className="space-y-2">
            <Button variant="tertiary" size="sm" icon="pencil" onClick={() => setEditing("show")}>
              Edit
            </Button>
            <AddSiblingActions
              showId={show.id}
              runId={singleRun.id}
              venueId={venues[0]?.id}
              showAddRun
              showAddPerformance
              onRunCreated={() => window.location.reload()}
              onPerformanceCreated={() => window.location.reload()}
            />
          </div>
        )}
        {editing && (
          <div className="space-y-4">
            <InlineEditor
              entityType="show"
              entityId={decodeId(show.id)}
              initialValues={{
                title: show.title,
                description: show.description,
                performanceTypes: show.performanceTypes,
                duration: show.duration,
                url: show.url,
              }}
              onSaved={() => { setEditing(null); window.location.reload(); }}
              onCancel={() => setEditing(null)}
            />
            <InlineEditor
              entityType="run"
              entityId={decodeId(singleRun.id)}
              initialValues={{
                title: singleRun.title || "",
                description: singleRun.description || "",
                intermissions: singleRun.intermissions ?? 0,
                startDate: singleRun.startDate || "",
                endDate: singleRun.endDate || "",
              }}
              onSaved={() => window.location.reload()}
              onCancel={() => setEditing(null)}
            />
            <InlineEditor
              entityType="performance"
              entityId={decodeId(singlePerf.id)}
              initialValues={{
                date: singlePerf.date || "",
                time: singlePerf.time || "",
                ticketUrl: singlePerf.ticketUrl || "",
                soldOut: String(isSoldOut),
              }}
              onSaved={() => window.location.reload()}
              onCancel={() => setEditing(null)}
            />
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
      <div className="relative">
        <div className="px-6 py-8 max-w-[var(--content-width)] mx-auto space-y-8">
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
          posterUrl={show.posterUrl}
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

        <div className="flex items-center gap-3">
          <WatchlistButton
            showId={show.id}
            initialIsOnWatchlist={show.isOnMyWatchlist ?? false}
            initialWatchlistCount={show.watchlistCount ?? 0}
          />
          <AddToListButton itemId={show.id} listType="shows" />
        </div>

        {upcomingShowings.length > 0 && (
          <ShowingsList showings={upcomingShowings} label="Upcoming Shows" />
        )}

        <Link
          href={`/log?run=${singleRun.id}`}
          className="block w-full dog-ear dog-ear-dark bg-curtn-coral py-3 text-center font-display text-sm font-bold uppercase tracking-wide text-curtn-deep transition-colors hover:bg-curtn-red"
        >
          Log This Show
        </Link>

        <CreditsList cast={singleRun.cast ?? []} crew={singleRun.crew ?? []} />

        {isAdmin && !editing && (
          <div className="space-y-2">
            <Button variant="tertiary" size="sm" icon="pencil" onClick={() => setEditing("show")}>
              Edit
            </Button>
            <AddSiblingActions
              showId={show.id}
              showAddRun
              onRunCreated={() => window.location.reload()}
            />
          </div>
        )}
        {editing && (
          <div className="space-y-4">
            <InlineEditor
              entityType="show"
              entityId={decodeId(show.id)}
              initialValues={{
                title: show.title,
                description: show.description,
                performanceTypes: show.performanceTypes,
                duration: show.duration,
                url: show.url,
              }}
              onSaved={() => { setEditing(null); window.location.reload(); }}
              onCancel={() => setEditing(null)}
            />
            <InlineEditor
              entityType="run"
              entityId={decodeId(singleRun.id)}
              initialValues={{
                title: singleRun.title || "",
                description: singleRun.description || "",
                intermissions: singleRun.intermissions ?? 0,
                startDate: singleRun.startDate || "",
                endDate: singleRun.endDate || "",
              }}
              onSaved={() => window.location.reload()}
              onCancel={() => setEditing(null)}
            />
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
      </div>
    );
  }

  // --- SCENARIO C: multiple runs — show info + run list ---
  return (
    <div className="relative">
      <div className="px-6 py-8 max-w-[var(--content-width)] mx-auto space-y-8">
        <ShowHero
          title={show.title}
          description={show.description}
          performanceTypes={show.performanceTypes}
          duration={show.duration}
          languages={show.languages}
          imageUrl={show.imageUrl}
          posterUrl={show.posterUrl}
          creators={creators}
          averageRating={show.averageRating}
          reviewCount={show.reviewCount}
        />

        <WatchlistButton
          showId={show.id}
          initialIsOnWatchlist={show.isOnMyWatchlist ?? false}
          initialWatchlistCount={show.watchlistCount ?? 0}
        />

        {isAdmin && !editing && (
          <div className="space-y-2">
            <Button variant="tertiary" size="sm" icon="pencil" onClick={() => setEditing("show")}>
              Edit
            </Button>
            <AddSiblingActions
              showId={show.id}
              showAddRun
              onRunCreated={() => window.location.reload()}
            />
          </div>
        )}
        {editing === "show" && (
          <InlineEditor
            entityType="show"
            entityId={decodeId(show.id)}
            initialValues={{
              title: show.title,
              description: show.description,
              performanceTypes: show.performanceTypes,
              duration: show.duration,
              url: show.url,
            }}
            onSaved={() => { setEditing(null); window.location.reload(); }}
            onCancel={() => setEditing(null)}
          />
        )}

        <div className="relative">
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

        {/* Reviews — All Productions */}
        <div className="relative">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs uppercase tracking-widest text-curtn-muted">
              Reviews &middot; All Productions
              {displayReviewEdges.length > 0 && ` (${displayReviewEdges.length}${reviewPageInfo?.hasNextPage ? "+" : ""})`}
            </h2>
            {!!user && (
              <div className="flex rounded-lg border border-curtn-dark overflow-hidden text-xs">
                <button
                  type="button"
                  onClick={() => { setFollowedOnly(false); setReviewAfter(null); setAllReviewEdges([]); }}
                  className={`px-2.5 py-1 transition-colors cursor-pointer ${!followedOnly ? "bg-curtn-dark text-curtn-cream" : "text-curtn-muted hover:text-curtn-cream"}`}
                >
                  All
                </button>
                <button
                  type="button"
                  onClick={() => { setFollowedOnly(true); setReviewAfter(null); setAllReviewEdges([]); }}
                  className={`px-2.5 py-1 transition-colors cursor-pointer ${followedOnly ? "bg-curtn-dark text-curtn-cream" : "text-curtn-muted hover:text-curtn-cream"}`}
                >
                  Friends
                </button>
              </div>
            )}
          </div>

          {!reviewsFetching && displayReviewEdges.length === 0 && (
            <div className="empty-state">
              <p className="font-display text-base font-bold uppercase mb-1.5 text-curtn-cream">No Reviews Yet</p>
              <p className="text-xs text-curtn-muted max-w-[260px] mx-auto">Be the first to share your thoughts.</p>
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
    <div className="relative">
      <h2 className="mb-3 text-xs uppercase tracking-widest text-curtn-muted">
        Reviews
        {edges.length > 0 &&
          ` (${edges.length}${pageInfo?.hasNextPage ? "+" : ""})`}
      </h2>

      {!fetching && edges.length === 0 && (
        <div className="empty-state">
          <p className="font-display text-base font-bold uppercase mb-1.5 text-curtn-cream">No Reviews Yet</p>
          <p className="text-xs text-curtn-muted max-w-[260px] mx-auto">Be the first to share your thoughts.</p>
        </div>
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
          className="mt-4 w-full border border-curtn-dark py-2.5 text-sm text-curtn-muted transition-colors hover:border-curtn-muted/50 hover:text-curtn-cream cursor-pointer"
        >
          Load more reviews
        </button>
      )}
    </div>
  );
}
