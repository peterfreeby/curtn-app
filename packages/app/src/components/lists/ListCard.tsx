"use client";

import { useState } from "react";
import Link from "next/link";
import { Icon } from "@/components/icons/Icons";

const LIST_TYPE_LABELS: Record<string, string> = {
  shows: "Shows",
  venues: "Venues",
  runs: "Runs",
  performances: "Performances",
  people: "People",
};

const MAX_POSTERS = 5;

interface ListCardProps {
  name: string;
  slug: string;
  listType: string;
  itemCount: number;
  ownerUsername: string;
  ownerAvatarUrl?: string | null;
  isPublic: boolean;
  description?: string | null;
  posterUrls?: string[];
}

function PosterStrip({ urls }: { urls: string[] }) {
  const [failed, setFailed] = useState<Set<number>>(() => new Set());
  const visible = urls.slice(0, MAX_POSTERS).filter((_, i) => !failed.has(i));

  if (visible.length === 0) return null;

  return (
    <div className="flex items-end -space-x-4">
      {urls.slice(0, MAX_POSTERS).map((url, i) =>
        failed.has(i) ? null : (
          <div
            key={i}
            className="relative shrink-0 w-[80px] aspect-[2/3] overflow-hidden border border-curtn-dark/40 bg-curtn-dark/20 transition-transform duration-200 group-hover:translate-y-[-2px]"
            style={{ zIndex: MAX_POSTERS - i }}
          >
            <img
              src={url}
              alt=""
              className="h-full w-full object-cover"
              onError={() => setFailed((prev) => new Set(prev).add(i))}
            />
          </div>
        )
      )}
    </div>
  );
}

export function ListCard({
  name,
  slug,
  listType,
  itemCount,
  ownerUsername,
  ownerAvatarUrl,
  isPublic,
  description,
  posterUrls,
}: ListCardProps) {
  const hasPosters = posterUrls && posterUrls.length > 0;

  return (
    <Link
      href={`/u/${ownerUsername}/lists/${slug}`}
      className="group block overflow-hidden"
    >
      {hasPosters && <PosterStrip urls={posterUrls} />}

      <div className={hasPosters ? "pt-[var(--spacing-1_5)]" : ""}>
        <div className="flex items-center gap-1.5">
          <span className="inline-block bg-curtn-dark/60 px-2 py-0.5 text-[10px] uppercase tracking-wider text-curtn-muted">
            {LIST_TYPE_LABELS[listType] ?? listType}
          </span>
          {!isPublic && (
            <span className="inline-block bg-curtn-dark/60 px-2 py-0.5 text-[10px] uppercase tracking-wider text-curtn-muted/70">
              Private
            </span>
          )}
        </div>

        <h3 className="mt-[var(--spacing-0_5)] text-sm font-semibold text-curtn-cream line-clamp-2 leading-snug">
          {name}
        </h3>

        {description && (
          <p className="mt-[var(--spacing-0_5)] text-xs text-curtn-muted line-clamp-2">
            {description}
          </p>
        )}

        <div className="mt-[var(--spacing-1)] flex items-center justify-between">
          <div className="flex items-center gap-1 text-xs text-curtn-muted/70">
            <Icon name="list-bullets" size={12} className="text-curtn-muted/50" />
            <span>{itemCount} {itemCount === 1 ? "item" : "items"}</span>
          </div>

          <div className="flex items-center gap-1.5">
            {ownerAvatarUrl ? (
              <img
                src={ownerAvatarUrl}
                alt={ownerUsername}
                className="h-4 w-4 rounded-full object-cover"
              />
            ) : (
              <Icon name="user" size={12} className="text-curtn-muted/50" />
            )}
            <span className="text-[10px] text-curtn-muted">@{ownerUsername}</span>
          </div>
        </div>
      </div>
    </Link>
  );
}

export { LIST_TYPE_LABELS };
