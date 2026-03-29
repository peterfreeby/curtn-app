"use client";

import { useMutation } from "urql";
import Link from "next/link";
import { StarRating } from "@/components/StarRating";
import { Icon } from "@/components/icons/Icons";
import { Avatar } from "@/components/Avatar";
import { REVIEW_DELETE_MUTATION } from "@/lib/graphql/reviews";
import { useAuth } from "@/lib/auth/useAuth";

interface ReviewCardProps {
  review: {
    id: string;
    rating: number;
    text?: string | null;
    venue?: string | null;
    attendedAt?: string | null;
    createdAt?: string | null;
    isFollowedByViewer?: boolean | null;
    user?: { id: string; username: string; fullName?: string; avatarUrl?: string | null } | null;
    run?: { id: string; show: { id: string; title: string; imageUrl?: string | null; posterUrl?: string | null } } | null;
  };
  showPerformanceLink?: boolean;
  onDeleted?: () => void;
}

export function ReviewCard({ review, showPerformanceLink = false, onDeleted }: ReviewCardProps) {
  const { user: currentUser } = useAuth();
  const [{ fetching: deleting }, deleteReview] = useMutation(REVIEW_DELETE_MUTATION);

  const isOwner = currentUser && review.user && currentUser.id === review.user.id;

  async function handleDelete() {
    if (!confirm("Delete this review?")) return;
    const result = await deleteReview({ input: { id: review.id } });
    if (!result.data?.reviewDelete?.error && onDeleted) {
      onDeleted();
    }
  }

  const dateStr = review.createdAt
    ? new Date(review.createdAt).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : "";

  const showTitle = review.run?.show?.title;
  const showImageUrl = review.run?.show?.posterUrl || review.run?.show?.imageUrl;
  const runId = review.run?.id;
  const reviewerName = review.user?.fullName || review.user?.username || "Anonymous";

  return (
    <div
      className={`border-b border-curtn-dark/40 py-3 ${
        review.isFollowedByViewer ? "border-l-2 border-l-curtn-coral/50 pl-3" : ""
      }`}
    >
      {/* Show link when in feed/profile context */}
      {showPerformanceLink && showTitle && runId && (
        <div className="flex items-center gap-2 mb-2">
          {showImageUrl && (
            <Link
              href={`/runs/${encodeURIComponent(runId)}`}
              className="w-8 shrink-0"
            >
              <div className="aspect-[2/3] overflow-hidden rounded-sm bg-curtn-dark/30">
                <img src={showImageUrl} alt={showTitle} className="h-full w-full object-cover" />
              </div>
            </Link>
          )}
          <Link
            href={`/runs/${encodeURIComponent(runId)}`}
            className="text-sm font-medium text-curtn-cream hover:text-curtn-coral transition-colors truncate"
          >
            {showTitle}
          </Link>
        </div>
      )}

      {/* Author line */}
      <div className="flex items-center gap-2">
        <Avatar
          src={review.user?.avatarUrl}
          name={reviewerName}
          size="sm"
        />
        {review.user ? (
          <Link
            href={`/u/${encodeURIComponent(review.user.username)}`}
            className="text-sm text-curtn-cream font-medium hover:text-curtn-coral transition-colors"
          >
            {reviewerName}
          </Link>
        ) : (
          <span className="text-sm text-curtn-cream font-medium">Anonymous</span>
        )}
        <StarRating value={review.rating} size={13} readOnly />
        <span className="text-xs text-curtn-muted/40 ml-auto">{dateStr}</span>
      </div>

      {/* Review text */}
      {review.text && (
        <p className="mt-1.5 text-sm text-curtn-cream/80 leading-relaxed line-clamp-4">
          {review.text}
        </p>
      )}

      {/* Actions */}
      <div className="mt-2 flex items-center gap-4 text-xs text-curtn-muted/50">
        {/* Placeholder slots for future reply/share */}
        {isOwner && (
          <button
            type="button"
            onClick={handleDelete}
            disabled={deleting}
            className="hover:text-curtn-red transition-colors cursor-pointer disabled:opacity-40"
          >
            Delete
          </button>
        )}
      </div>
    </div>
  );
}
