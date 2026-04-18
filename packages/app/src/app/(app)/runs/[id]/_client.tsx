"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { useNowViewing } from "@/lib/NowViewingContext";
import { useQuery, useMutation } from "urql";
import Link from "next/link";
import { SINGLE_RUN_QUERY } from "@/lib/graphql/runs";
import { SEEN_CREATE_MUTATION, SEEN_DELETE_MUTATION } from "@/lib/graphql/seen";
import { Toast } from "@/components/Toast";
import { RUN_REVIEWS_QUERY } from "@/lib/graphql/performances";
import { DetailHero } from "@/components/DetailHero";
import { ShowingsList } from "@/components/performances/ShowingsList";
import { CreditsList } from "@/components/credits/CreditsList";
import { ReviewCard } from "@/components/reviews/ReviewCard";
import { Icon } from "@/components/icons/Icons";
import { useAuth } from "@/lib/auth/useAuth";
import { AddToListButton } from "@/components/lists/AddToListButton";
import { Button } from "@/components/Button";
import { InlineEditor } from "@/components/admin/InlineEditor";
import { BatchPerformanceCreator } from "@/components/admin/BatchPerformanceCreator";
import { EntityDataSourcesPanel } from "@/components/admin/EntityDataSourcesPanel";
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
  const btn = (active: boolean) =>
    `px-2.5 py-1 transition-colors cursor-pointer ${
      active ? "bg-curtn-dark text-curtn-cream" : "text-curtn-muted hover:text-curtn-cream"
    }`;

  return (
    <div className="flex items-center gap-2 flex-wrap text-xs">
      <div className="flex rounded-lg border border-curtn-dark overflow-hidden">
        <button type="button" onClick={() => onScopeChange("run")} className={btn(reviewScope === "run")}>
          This Run
        </button>
        <button type="button" onClick={() => onScopeChange("show")} className={btn(reviewScope === "show")}>
          All
        </button>
      </div>
      {isAuthenticated && (
        <div className="flex rounded-lg border border-curtn-dark overflow-hidden">
          <button type="button" onClick={() => onFollowedChange(false)} className={btn(!followedOnly)}>
            Everyone
          </button>
          <button type="button" onClick={() => onFollowedChange(true)} className={btn(followedOnly)}>
            Friends
          </button>
        </div>
      )}
    </div>
  );
}

const REVIEW_PAGE_SIZE = 12;

export default function RunDetailPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const id = decodeURIComponent(params.id as string);
  const { isAuthenticated, user } = useAuth();
  const isAdmin = !!user?.isAdmin;
  const [editing, setEditing] = useState(false);
  const [batchCreating, setBatchCreating] = useState(false);
  const forceView = searchParams.get("view");

  const [{ data, fetching }, reexecuteRun] = useQuery({
    query: SINGLE_RUN_QUERY,
    variables: { id },
  });

  const [reviewAfter, setReviewAfter] = useState<string | null>(null);
  const [allReviewEdges, setAllReviewEdges] = useState<any[]>([]);
  const [followedOnly, setFollowedOnly] = useState(false);
  const [reviewScope, setReviewScope] = useState<"run" | "show">("run");

  // Seen state
  const [, executeSeenCreate] = useMutation(SEEN_CREATE_MUTATION);
  const [, executeSeenDelete] = useMutation(SEEN_DELETE_MUTATION);
  const [hasSeen, setHasSeen] = useState(false);
  const [seenToast, setSeenToast] = useState(false);

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
      const allPerfs = run.performances?.edges?.map((e: any) => e.node) ?? [];
      const onlyOnePerf = allPerfs.length === 1 ? allPerfs[0] : null;

      const breadcrumbs = [
        { label: run.show.title, sublabel: 'Show', href: `/performances/${encodeURIComponent(run.show.id)}?view=show` },
        { label: sub || 'Production', sublabel: 'Run', href: `/runs/${encodeURIComponent(id)}?view=run` },
      ];
      if (onlyOnePerf) {
        const perfDate = new Date(onlyOnePerf.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        breadcrumbs.push({ label: perfDate, sublabel: 'Performance', href: `/runs/${encodeURIComponent(id)}` });
      }

      setNowViewing({
        title: run.show.title,
        subtitle: sub,
        entityType: forceView === 'run' ? 'Run' : (onlyOnePerf ? 'Performance' : 'Run'),
        posterUrl: run.posterUrl || run.imageUrl || run.show.posterUrl || run.show.imageUrl,
        showId: run.show.id,
        runId: run.id,
        isOnWatchlist: false,
        viewerHasSeen: hasSeen,
        href: `/runs/${encodeURIComponent(id)}`,
        parentHref: `/performances/${encodeURIComponent(run.show.id)}`,
        breadcrumbs,
      });
    }
    return () => setNowViewing(null);
  }, [run?.show?.title, run?.posterUrl, run?.imageUrl, id, hasSeen, setNowViewing]);

  // Sync seen state from server data
  useEffect(() => {
    if (run?.viewerHasSeen != null) setHasSeen(run.viewerHasSeen);
  }, [run?.viewerHasSeen]);

  const handleSeenToggle = useCallback(async () => {
    if (!isAuthenticated) return;
    if (hasSeen) {
      setHasSeen(false);
      const result = await executeSeenDelete({ input: { runId: id } });
      if (result.error || result.data?.seenDelete?.error) {
        setHasSeen(true); // revert on failure
      }
    } else {
      setHasSeen(true);
      setSeenToast(true);
      const result = await executeSeenCreate({ input: { runId: id } });
      if (result.error || result.data?.seenCreate?.error) {
        setHasSeen(false); // revert on failure
        setSeenToast(false);
      }
    }
  }, [isAuthenticated, hasSeen, id, executeSeenCreate, executeSeenDelete]);

  if (fetching) {
    return (
      <div className="px-2 sm:px-6 py-8 max-w-[var(--content-width)] mx-auto animate-pulse space-y-4">
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
      <div className="px-2 sm:px-6 py-8 max-w-[var(--content-width)] mx-auto">
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
  // Skip collapse if ?view=run forces the run-level view
  if (singlePerf && forceView !== "run") {
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
        <div className="px-2 sm:px-6 py-8 max-w-[var(--content-width)] mx-auto space-y-8">
        <DetailHero
          title={show.title}
          description={run.description || show.description}
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
          totalAttendees={run.totalAttendees}
          onEdit={isAdmin ? () => setEditing(true) : undefined}
          entityType={forceView === "run" ? "Run" : "Performance"}
        />

        <div className="hidden sm:block">
          {isAuthenticated && (
            <AddToListButton listType="runs" itemId={id} />
          )}
        </div>

        {isAuthenticated && (
          <button
            type="button"
            onClick={handleSeenToggle}
            className={`hidden sm:block w-full py-3 text-center font-display text-sm font-bold uppercase tracking-wide transition-colors ${
              hasSeen
                ? "border border-curtn-dark text-curtn-muted hover:text-curtn-cream hover:border-curtn-muted/50"
                : "dog-ear dog-ear-dark bg-curtn-coral text-curtn-deep hover:bg-curtn-red"
            }`}
          >
            {hasSeen ? "Logged" : "Log This Show"}
          </button>
        )}
        {!isAuthenticated && (
          <Link
            href="/login"
            className="hidden sm:block w-full dog-ear dog-ear-dark bg-curtn-coral py-3 text-center font-display text-sm font-bold uppercase tracking-wide text-curtn-deep transition-colors hover:bg-curtn-red"
          >
            Log This Show
          </Link>
        )}

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
            initialVenues={(run.venues || []).map((v: any) => ({ id: v.id, name: v.name }))}
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

        {isAdmin && (
          <EntityDataSourcesPanel entityType="run" entityId={id} />
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
        {seenToast && (
          <Toast
            message="Logged"
            actionLabel="Add details"
            actionHref={`/log?run=${id}`}
            onDismiss={() => setSeenToast(false)}
          />
        )}
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
      <div className="px-2 sm:px-6 py-8 max-w-[var(--content-width)] mx-auto space-y-8">
      <DetailHero
        title={show.title}
        description={run.description || show.description}
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
        totalAttendees={run.totalAttendees}
        onEdit={isAdmin ? () => setEditing(true) : undefined}
        entityType="Run"
      />

      <div className="hidden sm:block">
        {isAuthenticated && <AddToListButton listType="runs" itemId={id} />}
      </div>

      {upcomingShowings.length > 0 && (
        <ShowingsList showings={upcomingShowings} label="Upcoming Performances" runId={id} />
      )}

      {isAuthenticated && (
        <button
          type="button"
          onClick={handleSeenToggle}
          className={`hidden sm:block w-full py-3 text-center font-display text-sm font-bold uppercase tracking-wide transition-colors ${
            hasSeen
              ? "border border-curtn-dark text-curtn-muted hover:text-curtn-cream hover:border-curtn-muted/50"
              : "dog-ear dog-ear-dark bg-curtn-coral text-curtn-deep hover:bg-curtn-red"
          }`}
        >
          {hasSeen ? "Logged" : "Log This Show"}
        </button>
      )}
      {!isAuthenticated && (
        <Link
          href="/login"
          className="hidden sm:block w-full dog-ear dog-ear-dark bg-curtn-coral py-3 text-center font-display text-sm font-bold uppercase tracking-wide text-curtn-deep transition-colors hover:bg-curtn-red"
        >
          Log This Show
        </Link>
      )}

      <CreditsList cast={run.cast ?? []} crew={run.crew ?? []} />

      {isAdmin && !editing && !batchCreating && (
        <div className="hidden sm:flex gap-2">
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
          initialVenues={(run.venues || []).map((v: any) => ({ id: v.id, name: v.name }))}
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

      {isAdmin && (
        <EntityDataSourcesPanel entityType="run" entityId={id} />
      )}

      {/* Reviews */}
      <div className="relative">
        <div className="mb-3">
          <h2 className="text-xs uppercase tracking-widest text-curtn-muted mb-2">
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
        <ShowingsList showings={pastShowings} label="Past Performances" runId={id} onAdd={isAdmin ? () => setBatchCreating(true) : undefined} />
      )}
      {seenToast && (
        <Toast
          message="Logged"
          actionLabel="Add details"
          actionHref={`/log?run=${id}`}
          onDismiss={() => setSeenToast(false)}
        />
      )}
    </div>
    </div>
  );
}
