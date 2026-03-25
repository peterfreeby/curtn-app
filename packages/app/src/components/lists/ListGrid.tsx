"use client";

import { ListCard } from "./ListCard";
import { ListCardSkeleton } from "./ListCardSkeleton";

interface ListNode {
  id: string;
  name: string;
  slug: string;
  listType: string;
  itemCount: number;
  isPublic: boolean;
  description?: string | null;
  owner: {
    username: string;
    avatarUrl?: string | null;
  };
}

interface ListGridProps {
  lists: ListNode[];
  loading: boolean;
  emptyMessage?: string;
}

export function ListGrid({ lists, loading, emptyMessage = "No lists found." }: ListGridProps) {
  if (loading) {
    return (
      <div className="grid grid-cols-1 gap-[var(--spacing-2)] md:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <ListCardSkeleton key={i} />
        ))}
      </div>
    );
  }

  if (lists.length === 0) {
    return (
      <div className="py-16 text-center">
        <p className="text-curtn-muted text-sm">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-[var(--spacing-2)] md:grid-cols-2 lg:grid-cols-3">
      {lists.map((l) => (
        <ListCard
          key={l.id}
          name={l.name}
          slug={l.slug}
          listType={l.listType}
          itemCount={l.itemCount}
          ownerUsername={l.owner.username}
          ownerAvatarUrl={l.owner.avatarUrl}
          isPublic={l.isPublic}
          description={l.description}
        />
      ))}
    </div>
  );
}
