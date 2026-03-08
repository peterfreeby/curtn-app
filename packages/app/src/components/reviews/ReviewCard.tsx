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
    user?: { id: string; username: string; fullName?: string; avatarUrl?: string | null } | null;
    run?: { id: string; show: { id: string; title: string; imageUrl?: string | null } } | null;
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
  const showImageUrl = review.run?.show?.imageUrl;
  const runId = review.run?.id;
  const reviewerName = review.user?.fullName || review.user?.username || "Anonymous";

  return (
    <div className="flex gap-[var(--spacing-2)] rounded-xl border border-curtn-dark/50 bg-curtn-surface p-[var(--spacing-2)]">
      {/* Poster thumbnail */}
      {showPerformanceLink && (
        <Link
          href={runId ? `/runs/${encodeURIComponent(runId)}` : "#"}
          className="w-[var(--spacing-9)] shrink-0"
        >
          <div className="aspect-[2/3] overflow-hidden rounded-[var(--spacing-0_5)] bg-curtn-dark/30 border border-curtn-dark/50">
            {showImageUrl ? (
              <img src={showImageUrl} alt={showTitle || ""} className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center">
                <Icon name="ticket" weight="thin" size={20} className="text-curtn-dark" />
              </div>
            )}
          </div>
        </Link>
      )}

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-[var(--spacing-1_5)]">
          <div className="space-y-[var(--spacing-0_5)] min-w-0">
            {showPerformanceLink && showTitle && runId && (
              <Link
                href={`/runs/${encodeURIComponent(runId)}`}
                className="text-sm font-semibold text-curtn-cream hover:text-curtn-coral transition-colors block truncate"
              >
                {showTitle}
              </Link>
            )}
            <div className="flex items-center gap-[var(--spacing-1)] text-sm">
              <Avatar
                src={review.user?.avatarUrl}
                name={reviewerName}
                size="sm"
              />
              {review.user ? (
                <Link
                  href={`/u/${encodeURIComponent(review.user.username)}`}
                  className="text-curtn-cream font-medium hover:text-curtn-coral transition-colors"
                >
                  {reviewerName}
                </Link>
              ) : (
                <span className="text-curtn-cream font-medium">Anonymous</span>
              )}
              <StarRating value={review.rating} size={14} readOnly />
            </div>
          </div>
          <div className="flex items-center gap-[var(--spacing-1)] shrink-0">
            <span className="text-xs text-curtn-muted/50">{dateStr}</span>
            {isOwner && (
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting}
                className="text-curtn-muted/50 hover:text-curtn-red transition-colors cursor-pointer disabled:opacity-40"
                aria-label="Delete review"
              >
                <Icon name="plus" weight="regular" size={14} className="rotate-45" />
              </button>
            )}
          </div>
        </div>
        {review.text && (
          <p className="mt-[var(--spacing-1)] text-sm text-curtn-cream/80 leading-relaxed line-clamp-3">
            {review.text}
          </p>
        )}
      </div>
    </div>
  );
}
