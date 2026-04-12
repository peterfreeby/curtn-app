"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { useQuery, useMutation } from "urql";
import { USER_BY_USERNAME_QUERY, USER_REVIEWS_QUERY } from "@/lib/graphql/users";
import { FOLLOW_TOGGLE_MUTATION } from "@/lib/graphql/follows";
import { MY_WATCHLIST_QUERY } from "@/lib/graphql/watchlist";
import { USER_SEEN_QUERY } from "@/lib/graphql/seen";
import { USER_LISTS_QUERY } from "@/lib/graphql/lists";
import { ProfileHeader } from "@/components/profile/ProfileHeader";
import { EditProfileModal } from "@/components/profile/EditProfileModal";
import { ProfileCredits } from "@/components/profile/ProfileCredits";
import { ClaimPrompt } from "@/components/profile/ClaimPrompt";
import { ReviewCard } from "@/components/reviews/ReviewCard";
import { SeenCard } from "@/components/seen/SeenCard";
import { WiredPosterCard } from "@/components/WiredPosterCard";
import { ListGrid } from "@/components/lists/ListGrid";
import { useAuth } from "@/lib/auth/useAuth";

const PAGE_SIZE = 12;

export default function ProfilePage() {
  const { username } = useParams<{ username: string }>();
  const { user: currentUser } = useAuth();

  const [activeTab, setActiveTab] = useState<"reviews" | "watchlist" | "lists" | "credits">("reviews");
  const [after, setAfter] = useState<string | null>(null);
  const [allEdges, setAllEdges] = useState<any[]>([]);
  const [showEditModal, setShowEditModal] = useState(false);

  const [{ data: userData, fetching: userFetching }, reexecuteUser] = useQuery({
    query: USER_BY_USERNAME_QUERY,
    variables: { username, first: 1 },
  });

  const [{ data: reviewData, fetching: reviewsFetching }, reexecute] = useQuery({
    query: USER_REVIEWS_QUERY,
    variables: { username, first: PAGE_SIZE, after },
  });

  const [{ data: seenData, fetching: seenFetching }] = useQuery({
    query: USER_SEEN_QUERY,
    variables: { username, first: 50 },
    pause: activeTab !== "reviews",
  });

  const [{ fetching: followLoading }, executeFollowToggle] = useMutation(FOLLOW_TOGGLE_MUTATION);

  const [{ data: watchlistData, fetching: watchlistFetching }] = useQuery({
    query: MY_WATCHLIST_QUERY,
    variables: { first: 50 },
    pause: activeTab !== "watchlist",
  });

  const profileUser = userData?.userList?.edges?.[0]?.node ?? null;

  const [{ data: listsData, fetching: listsFetching }] = useQuery({
    query: USER_LISTS_QUERY,
    variables: { userId: profileUser?.id, first: 50 },
    pause: activeTab !== "lists" || !profileUser,
  });
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
      <div className="px-2 sm:px-6 py-8 max-w-2xl mx-auto space-y-6">
        <div className="h-28 bg-curtn-dark/30 animate-pulse" />
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-24 bg-curtn-dark/30 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  // User not found
  if (!profileUser) {
    return (
      <div className="px-2 sm:px-6 py-8 max-w-2xl mx-auto">
        <div className="empty-state">
          <p className="font-display text-base font-bold uppercase mb-1.5 text-curtn-cream">User Not Found</p>
          <p className="text-xs text-curtn-muted max-w-[260px] mx-auto">
            @{username} doesn&apos;t exist or may have been removed.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="px-2 sm:px-6 py-8 max-w-2xl mx-auto space-y-8">
      <ProfileHeader
        fullName={profileUser.fullName}
        username={profileUser.username}
        bio={profileUser.bio}
        avatarUrl={profileUser.avatarUrl}
        reviewCount={displayEdges.length}
        followerCount={followerCount}
        followingCount={profileUser.followingCount ?? 0}
        isOwnProfile={isOwnProfile}
        isFollowing={isFollowing}
        onFollowToggle={handleFollowToggle}
        followLoading={followLoading}
        isAuthenticated={!!currentUser}
        onEditProfile={() => setShowEditModal(true)}
      />

      {showEditModal && profileUser && (
        <EditProfileModal
          fullName={profileUser.fullName}
          bio={profileUser.bio || ""}
          avatarUrl={profileUser.avatarUrl || ""}
          onClose={() => setShowEditModal(false)}
          onSaved={() => reexecuteUser({ requestPolicy: "network-only" })}
        />
      )}

      {isOwnProfile && !profileUser.person && (
        <ClaimPrompt onSubmitted={() => reexecuteUser({ requestPolicy: "network-only" })} />
      )}

      <div className="tabs-ledger">
        <button
          onClick={() => setActiveTab("reviews")}
          className={`tab-ledger flex-1 cursor-pointer ${
            activeTab === "reviews" ? "active" : ""
          }`}
        >
          Shows Seen
        </button>
        {profileUser.person && (
          <button
            onClick={() => setActiveTab("credits")}
            className={`tab-ledger flex-1 cursor-pointer ${
              activeTab === "credits" ? "active" : ""
            }`}
          >
            Credits
          </button>
        )}
        {isOwnProfile && (
          <button
            onClick={() => setActiveTab("watchlist")}
            className={`tab-ledger flex-1 cursor-pointer ${
              activeTab === "watchlist" ? "active" : ""
            }`}
          >
            Watchlist
          </button>
        )}
        <button
          onClick={() => setActiveTab("lists")}
          className={`tab-ledger flex-1 cursor-pointer ${
            activeTab === "lists" ? "active" : ""
          }`}
        >
          Lists
        </button>
      </div>

      {activeTab === "reviews" && (() => {
        const seenEdges = seenData?.seenList?.edges ?? [];
        const hasReviews = displayEdges.length > 0;
        const hasSeen = seenEdges.length > 0;
        const hasAnything = hasReviews || hasSeen;
        const isLoading = reviewsFetching && !hasReviews;

        return (
          <section>
            <h2 className="text-xs uppercase tracking-widest text-curtn-muted mb-4">
              Shows Seen
            </h2>

            {!hasAnything && !isLoading ? (
              <div className="empty-state">
                <p className="font-display text-base font-bold uppercase mb-1.5 text-curtn-cream">No Shows Logged</p>
                <p className="text-xs text-curtn-muted max-w-[260px] mx-auto">
                  {isOwnProfile
                    ? "Log a performance to start building your history."
                    : `@${username} hasn\u2019t logged anything yet.`}
                </p>
              </div>
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
                {seenEdges.map((edge: any) => (
                  <SeenCard key={edge.node.id} seen={edge.node} />
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
                className="mt-4 w-full border border-curtn-dark py-2.5 text-sm text-curtn-muted transition-colors hover:border-curtn-muted/50 hover:text-curtn-cream cursor-pointer"
              >
                Load more
              </button>
            )}
          </section>
        );
      })()}

      {activeTab === "credits" && profileUser.person && (
        <section>
          <h2 className="text-xs uppercase tracking-widest text-curtn-muted mb-4">
            Credits
          </h2>
          <ProfileCredits
            castCredits={profileUser.person.castCredits ?? []}
            crewCredits={profileUser.person.crewCredits ?? []}
            showCredits={profileUser.person.showCredits ?? []}
            isOwnProfile={isOwnProfile}
          />
        </section>
      )}

      {activeTab === "lists" && (
        <section>
          <h2 className="text-xs uppercase tracking-widest text-curtn-muted mb-4">
            Lists
          </h2>
          <ListGrid
            lists={listsData?.userLists?.edges?.map((e: any) => e.node) ?? []}
            loading={listsFetching}
            emptyMessage={isOwnProfile ? "You haven\u2019t created any lists yet." : `@${username} hasn\u2019t created any public lists yet.`}
          />
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
            <div className="empty-state">
              <p className="font-display text-base font-bold uppercase mb-1.5 text-curtn-cream">Your Watchlist Is Empty</p>
              <p className="text-xs text-curtn-muted max-w-[260px] mx-auto">
                Browse performances and tap &ldquo;Want to see&rdquo; to add them here.
              </p>
            </div>
          )}

          {!watchlistFetching && (watchlistData?.myWatchlist?.edges?.length ?? 0) > 0 && (
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-[var(--spacing-2)]">
              {watchlistData.myWatchlist.edges.map((edge: any) => {
                const show = edge.node;
                return (
                  <WiredPosterCard
                    key={show.id}
                    showId={show.id}
                    imageUrl={show.posterUrl || show.imageUrl}
                    title={show.title}
                    href={`/performances/${encodeURIComponent(show.id)}`}
                    size="md"
                    className="!w-full"
                    isOnWatchlist={true}
                  />
                );
              })}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
