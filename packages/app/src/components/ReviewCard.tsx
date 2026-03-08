import { Icon } from "@/components/icons/Icons";
import { Avatar } from "@/components/Avatar";
import { StarRating } from "@/components/StarRating";

interface ReviewCardProps {
  posterUrl?: string | null;
  title: string;
  year?: string;
  reviewerName: string;
  reviewerAvatar?: string | null;
  rating: number | null;
  reviewText?: string;
  likeCount?: number;
  href?: string;
  className?: string;
}

export function ReviewCard({
  posterUrl,
  title,
  year,
  reviewerName,
  reviewerAvatar,
  rating,
  reviewText,
  likeCount,
  href,
  className = "",
}: ReviewCardProps) {
  const Wrapper = href ? "a" : "div";
  const wrapperProps = href ? { href } : {};

  return (
    <Wrapper
      {...wrapperProps}
      className={`flex gap-[var(--spacing-2)] rounded-xl bg-curtn-surface border border-curtn-dark/30 p-[var(--spacing-2)] transition-colors hover:border-curtn-muted/30 ${className}`}
    >
      {/* Poster thumbnail */}
      <div className="w-[var(--spacing-10)] shrink-0">
        <div className="aspect-[2/3] overflow-hidden rounded-[var(--spacing-0_5)] bg-curtn-dark/30 border border-curtn-dark/50">
          {posterUrl ? (
            <img src={posterUrl} alt={title} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <Icon name="ticket" weight="thin" size={24} className="text-curtn-dark" />
            </div>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-[var(--spacing-1)]">
          <h3 className="text-base font-bold text-curtn-cream truncate">{title}</h3>
          {year && <span className="text-sm text-curtn-muted shrink-0">{year}</span>}
        </div>

        {/* Reviewer + rating */}
        <div className="mt-[var(--spacing-0_5)] flex items-center gap-[var(--spacing-1)]">
          <Avatar src={reviewerAvatar} name={reviewerName} size="sm" />
          <span className="text-sm text-curtn-cream">{reviewerName}</span>
          {rating !== null && <StarRating value={rating} readOnly size={14} />}
        </div>

        {/* Review text */}
        {reviewText && (
          <p className="mt-[var(--spacing-1)] text-sm text-curtn-cream/80 leading-relaxed line-clamp-3">
            {reviewText}
          </p>
        )}

        {/* Like count */}
        {likeCount !== undefined && likeCount > 0 && (
          <div className="mt-[var(--spacing-1)] flex items-center gap-[var(--spacing-0_5)] text-xs text-curtn-muted">
            <Icon name="heart" weight="fill" size={12} className="text-curtn-muted" />
            <span>Like review</span>
            <span>{likeCount.toLocaleString()} likes</span>
          </div>
        )}
      </div>
    </Wrapper>
  );
}
