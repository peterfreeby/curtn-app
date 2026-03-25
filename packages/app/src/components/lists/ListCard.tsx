"use client";

import Link from "next/link";
import { Icon } from "@/components/icons/Icons";

const LIST_TYPE_LABELS: Record<string, string> = {
  shows: "Shows",
  venues: "Venues",
  runs: "Runs",
  performances: "Performances",
  people: "People",
};

interface ListCardProps {
  name: string;
  slug: string;
  listType: string;
  itemCount: number;
  ownerUsername: string;
  ownerAvatarUrl?: string | null;
  isPublic: boolean;
  description?: string | null;
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
}: ListCardProps) {
  return (
    <Link
      href={`/u/${ownerUsername}/lists/${slug}`}
      className="group block dog-ear border border-curtn-dark/50 bg-curtn-surface overflow-hidden transition-colors duration-200 hover:border-curtn-muted/50"
    >
      <div className="p-[var(--spacing-2)]">
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
