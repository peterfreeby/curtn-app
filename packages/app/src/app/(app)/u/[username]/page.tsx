"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { useQuery, useMutation } from "urql";
import Link from "next/link";
import { USER_BY_USERNAME_QUERY, USER_REVIEWS_QUERY } from "@/lib/graphql/users";
import { FOLLOW_TOGGLE_MUTATION } from "@/lib/graphql/follows";
import { MY_WATCHLIST_QUERY } from "@/lib/graphql/watchlist";
import { ProfileHeader } from "@/components/profile/ProfileHeader";
import { ReviewCard } from "@/components/reviews/ReviewCard";
import { Card } from "@/components/Card";
import { useAuth } from "@/lib/auth/useAuth";

const PAGE_SIZE = 12;

export default function ProfilePage() {
  const { username } = useParams<{ username: string }>();
  const { user: currentUser } = useAuth();

  const [activeTab, setActiveTab] = useState<"reviews" | "watchlist">("reviews");
  const [after, setAfter] = useState<string | null>(null);
  const [allEdges, setAllEdges] = useState<any[]>([]);

  const [{ data: userData, fetching: userFetching }] = useQuery({
    query: USER_BY_USERNAME_QUERY,
    variables: { username, first: 1 },
  });

  const [{ data: reviewData, fetching: reviewsFetching }, reexecute] = useQuery({
    query: USER_REVIEWS_QUERY,
    variables: { username, first: PAGE_SIZE, after },
  });

  const [{ fetching: followLoading }, executeFollowToggle] = useMutation(FOLLOW_TOGGLE_MUTATION);

  const [{ data: watchlistData, fetching: watchlistFetching }] = useQuery({
    query: MY_WATCHLIST_QUERY,
    variables: { first: 50 },
    pause: activeTab !== "watchlist",
  });

  const profileUser = userData?.userList?.edges?.[0]?.node ?? null;
  const connection = reviewData?.reviewList;
  const edges = (connection?.edges ?? []).filter((e: any) => e.node != null);
  const pageInfo = connection?.pageInfo;
  const displayEdges = after === null ? edges : [...allEdges, ...edges];
  const isOwnProfile = !!(currentUser && profileUser && currentUser.id === profileUser.id);

  // Optimistic follow state
  const [optimisticFollowing, setOptimisticFollowing] = useState<boolean | null>(null);
  const [optimisticFollowerDelta, setOptimisticFollowerDelta] = useState(0);

  const isFollowing = optimisticFollowing ?? profileUser?.isFollowing ?? false;
  const followerCount = (profileUser?.followerCount ?? 0) + optimisticFollowerDelta;

  async function handleFollowToggle() {
    if (!profileUser) return;

    const wasFollowing = isFollowing;
    setOptimisticFollowing(!wasFollowing);
    setOptimisticFollowerDelta(prev => prev + (wasFollowing ? -1 : 1));

    const result = await executeFollowToggle({ input: { userId: profileUser.id } });

    if (result.error || result.data?.followToggle?.error) {
      setOptimisticFollowing(wasFollowing);
      setOptimisticFollowerDelta(prev => prev + (wasFollowing ? 1 : -1));
    }
  }

  function loadMore() {
    if (pageInfo?.endCursor) {
      setAllEdges(displayEdges);
      setAfter(pageInfo.endCursor);
    }
  }

  function handleDeleted() {
    setAfter(null);
    setAllEdges([]);
    reexecute({ requestPolicy: "network-only" });
  }

  // Loading state
  if (userFetching) {
    return (
      <div className="px-6 py-8 max-w-2xl mx-auto space-y-6">
        <div className="h-28 rounded-xl bg-curtn-dark/30 animate-pulse" />
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-24 rounded-lg bg-curtn-dark/30 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  // User not found
  if (!profileUser) {
    return (
      <div className="px-6 py-8 max-w-2xl mx-auto">
        <Card className="text-center py-16 space-y-2">
          <p className="text-curtn-cream font-medium">User not found</p>
          <p className="text-xs text-curtn-muted/60">
            @{username} doesn&apos;t exist or may have been removed.
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="px-6 py-8 max-w-2xl mx-auto space-y-8">
      <ProfileHeader
        fullName={profileUser.fullName}
        username={profileUser.username}
        reviewCount={displayEdges.length}
        followerCount={followerCount}
        followingCount={profileUser.followingCount ?? 0}
        isOwnProfile={isOwnProfile}
        isFollowing={isFollowing}
        onFollowToggle={handleFollowToggle}
        followLoading={followLoading}
        isAuthenticated={!!currentUser}
      />

      {isOwnProfile && (
        <div className="flex gap-1 rounded-lg bg-curtn-dark/30 p-1">
          <button
            onClick={() => setActiveTab("reviews")}
            className={`flex-1 rounded-md px-4 py-2 text-sm transition-colors cursor-pointer ${
              activeTab === "reviews"
                ? "bg-curtn-surface text-curtn-cream"
                : "text-curtn-muted hover:text-curtn-cream"
            }`}
          >
            Reviews
          </button>
          <button
            onClick={() => setActiveTab("watchlist")}
            className={`flex-1 rounded-md px-4 py-2 text-sm transition-colors cursor-pointer ${
              activeTab === "watchlist"
                ? "bg-curtn-surface text-curtn-cream"
                : "text-curtn-muted hover:text-curtn-cream"
            }`}
          >
            Watchlist
          </button>
        </div>
      )}

      {(!isOwnProfile || activeTab === "reviews") && (
        <section>
          <h2 className="text-xs uppercase tracking-widest text-curtn-muted mb-4">
            Reviews
          </h2>

          {displayEdges.length === 0 && !reviewsFetching ? (
            <Card className="text-center py-12 space-y-2">
              <p className="text-curtn-muted">No reviews yet.</p>
              <p className="text-xs text-curtn-muted/60">
                {isOwnProfile
                  ? "Log a performance to leave your first review."
                  : `@${username} hasn\u2019t reviewed anything yet.`}
              </p>
            </Card>
          ) : (
            <div className="space-y-3">
              {displayEdges.map((edge: any) => (
                <ReviewCard
                  key={edge.node.id}
                  review={edge.node}
                  showPerformanceLink
                  onDeleted={handleDeleted}
                />
              ))}
            </div>
          )}

          {reviewsFetching && (
            <div className="mt-3 flex justify-center">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-curtn-muted/30 border-t-curtn-coral" />
            </div>
          )}

          {!reviewsFetching && pageInfo?.hasNextPage && (
            <button
              type="button"
              onClick={loadMore}
              className="mt-4 w-full rounded-lg border border-curtn-dark py-2.5 text-sm text-curtn-muted transition-colors hover:border-curtn-muted/50 hover:text-curtn-cream cursor-pointer"
            >
              Load more reviews
            </button>
          )}
        </section>
      )}

      {isOwnProfile && activeTab === "watchlist" && (
        <section>
          <h2 className="text-xs uppercase tracking-widest text-curtn-muted mb-4">
            Want to See
          </h2>

          {watchlistFetching && (
            <div className="mt-3 flex justify-center">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-curtn-muted/30 border-t-curtn-coral" />
            </div>
          )}

          {!watchlistFetching && (watchlistData?.myWatchlist?.edges?.length ?? 0) === 0 && (
            <Card className="text-center py-12 space-y-2">
              <p className="text-curtn-muted">Your watchlist is empty.</p>
              <p className="text-xs text-curtn-muted/60">
                Browse performances and tap &ldquo;Want to see&rdquo; to add them here.
              </p>
            </Card>
          )}

          {!watchlistFetching && (watchlistData?.myWatchlist?.edges?.length ?? 0) > 0 && (
            <div className="space-y-3">
              {watchlistData.myWatchlist.edges.map((edge: any) => {
                const show = edge.node;
                return (
                  <Link
                    key={show.id}
                    href={`/performances/${encodeURIComponent(show.id)}`}
                    className="block"
                  >
                    <Card className="transition-colors hover:border-curtn-muted/30">
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <h3 className="text-sm font-medium text-curtn-cream truncate">
                            {show.title}
                          </h3>
                          {show.performanceTypes?.length > 0 && (
                            <div className="mt-1.5 flex flex-wrap gap-1.5">
                              {show.performanceTypes.map((t: string) => (
                                <span
                                  key={t}
                                  className="rounded-full bg-curtn-dark/60 px-2.5 py-0.5 text-[11px] text-curtn-muted"
                                >
                                  {t}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                        <div className="flex-shrink-0 text-right">
                          {show.averageRating != null && (
                            <p className="text-sm text-curtn-cream">
                              {show.averageRating.toFixed(1)}
                            </p>
                          )}
                          {show.reviewCount > 0 && (
                            <p className="text-[11px] text-curtn-muted">
                              {show.reviewCount} {show.reviewCount === 1 ? "review" : "reviews"}
                            </p>
                          )}
                        </div>
                      </div>
                    </Card>
                  </Link>
                );
              })}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
