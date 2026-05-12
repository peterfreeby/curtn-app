"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { FEED_REVIEWS_QUERY, FEED_SEEN_QUERY } from "@/lib/graphql/follows";
import { MY_NOTIFICATIONS_QUERY } from "@/lib/graphql/notifications";
import { ReviewCard } from "@/components/reviews/ReviewCard";
import { SeenCard } from "@/components/seen/SeenCard";
import { NotificationCard } from "@/components/notifications/NotificationCard";
import { InfiniteScrollSentinel } from "@/components/InfiniteScrollSentinel";
import { usePaginatedConnection } from "@/hooks/usePaginatedConnection";
import { useQuery } from "urql";
import { useAuth } from "@/lib/auth/useAuth";

type FeedFilter = "all" | "yours" | "following";

const FILTER_LABELS: Record<FeedFilter, string> = {
  all: "All",
  yours: "Yours",
  following: "Following",
};

export default function FeedPage() {
  const { user } = useAuth();
  const [filter, setFilter] = useState<FeedFilter>("all");

  const showFollowing = filter === "all" || filter === "following";
  const showYours = filter === "all" || filter === "yours";

  const { edges: reviewEdges, loading, loadingMore, hasNextPage, sentinelRef } =
    usePaginatedConnection({
      query: FEED_REVIEWS_QUERY,
      pageSize: 12,
      pause: !user || !showFollowing,
      getConnection: (data: any) => data?.feedReviews,
    });

  const [{ data: seenData }] = useQuery({
    query: FEED_SEEN_QUERY,
    variables: { first: 20 },
    pause: !user || !showFollowing,
  });

  const [{ data: notificationData, fetching: notificationsLoading }] = useQuery({
    query: MY_NOTIFICATIONS_QUERY,
    variables: { first: 30 },
    pause: !user || !showYours,
    requestPolicy: "cache-and-network",
  });

  const seenEdges = showFollowing ? seenData?.feedSeen?.edges ?? [] : [];
  const notificationEdges = showYours ? notificationData?.myNotifications?.edges ?? [] : [];

  const mergedFeed = useMemo(() => {
    const tagged: Array<{ type: "review" | "seen" | "notification"; node: any; createdAt: string }> = [];

    if (showFollowing) {
      for (const e of reviewEdges) {
        tagged.push({ type: "review", node: e.node, createdAt: e.node.createdAt });
      }
      for (const e of seenEdges) {
        tagged.push({ type: "seen", node: e.node, createdAt: e.node.createdAt });
      }
    }
    if (showYours) {
      for (const e of notificationEdges) {
        tagged.push({ type: "notification", node: e.node, createdAt: e.node.createdAt });
      }
    }

    tagged.sort((a, b) => {
      const da = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const db = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return db - da;
    });
    return tagged;
  }, [reviewEdges, seenEdges, notificationEdges, showFollowing, showYours]);

  if (!user) {
    return (
      <div className="px-2 sm:px-6 py-8 max-w-2xl mx-auto">
        <h2 className="text-xs uppercase tracking-widest text-curtn-muted mb-8">
          Feed
        </h2>
        <div className="empty-state">
          <p className="font-display text-base font-bold uppercase mb-1.5 text-curtn-cream">Sign In to See Your Feed</p>
          <p className="text-xs text-curtn-muted max-w-[260px] mx-auto mb-4">
            Follow people to see their reviews here.
          </p>
          <Link
            href="/login"
            className="inline-block dog-ear dog-ear-dark bg-curtn-coral px-6 py-2.5 text-sm font-semibold text-curtn-deep transition-colors hover:bg-curtn-red"
          >
            Sign in
          </Link>
        </div>
      </div>
    );
  }

  const isLoading = (showFollowing && loading) || (showYours && notificationsLoading && notificationEdges.length === 0);

  return (
    <div className="px-2 sm:px-6 py-8 max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xs uppercase tracking-widest text-curtn-muted">
          Feed
        </h2>
        <div className="flex gap-1 rounded-lg bg-curtn-surface p-1">
          {(["all", "yours", "following"] as FeedFilter[]).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer ${
                filter === f
                  ? "bg-curtn-deep text-curtn-cream"
                  : "text-curtn-muted hover:text-curtn-cream"
              }`}
            >
              {FILTER_LABELS[f]}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-24 rounded-lg bg-curtn-dark/30 animate-pulse" />
          ))}
        </div>
      ) : mergedFeed.length === 0 ? (
        <div className="empty-state">
          <p className="font-display text-base font-bold uppercase mb-1.5 text-curtn-cream">
            {filter === "yours" ? "No notifications yet" : "Your Feed Is Empty"}
          </p>
          <p className="text-xs text-curtn-muted max-w-[260px] mx-auto mb-4">
            {filter === "yours"
              ? "Activity on your claims and units will show up here."
              : "Follow people to see their activity here."}
          </p>
          {filter !== "yours" && (
            <Link
              href="/browse"
              className="inline-block border border-curtn-dark px-6 py-2.5 text-sm text-curtn-muted transition-colors hover:border-curtn-muted/50 hover:text-curtn-cream"
            >
              Browse performances
            </Link>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {mergedFeed.map((item) => {
            if (item.type === "review") {
              return (
                <ReviewCard
                  key={`review-${item.node.id}`}
                  review={item.node}
                  showPerformanceLink
                />
              );
            }
            if (item.type === "seen") {
              return (
                <SeenCard
                  key={`seen-${item.node.id}`}
                  seen={item.node}
                  showUser
                />
              );
            }
            return (
              <NotificationCard
                key={`notification-${item.node.id}`}
                notification={item.node}
              />
            );
          })}
        </div>
      )}

      {showFollowing && (
        <InfiniteScrollSentinel
          sentinelRef={sentinelRef}
          loadingMore={loadingMore}
          hasNextPage={hasNextPage}
        />
      )}
    </div>
  );
}
