"use client";

import { useMutation } from "urql";
import Link from "next/link";
import { StarRating } from "@/components/StarRating";
import { Icon } from "@/components/icons/Icons";
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
    user?: { id: string; username: string } | null;
    run?: { id: string; show: { id: string; title: string } } | null;
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
  const runId = review.run?.id;

  return (
    <div className="rounded-lg border border-curtn-dark/50 bg-curtn-surface p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1 min-w-0">
          {showPerformanceLink && showTitle && runId && (
            <Link
              href={`/runs/${encodeURIComponent(runId)}`}
              className="text-sm font-semibold text-curtn-cream hover:text-curtn-coral transition-colors block truncate"
            >
              {showTitle}
            </Link>
          )}
          <div className="flex items-center gap-2 text-sm">
            <StarRating value={review.rating} size={14} readOnly />
            {review.user ? (
              <Link
                href={`/u/${encodeURIComponent(review.user.username)}`}
                className="text-curtn-cream font-medium hover:text-curtn-coral transition-colors"
              >
                {review.user.username}
              </Link>
            ) : (
              <span className="text-curtn-cream font-medium">Anonymous</span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
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
        <p className="mt-2 text-sm text-curtn-cream/80 leading-relaxed">
          {review.text}
        </p>
      )}
    </div>
  );
}
