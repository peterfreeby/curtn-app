"use client";

import { ListCard } from "./ListCard";
import { ListCardSkeleton } from "./ListCardSkeleton";

interface ListItemNode {
  item?: {
    __typename?: string;
    posterUrl?: string | null;
    imageUrl?: string | null;
    venueImageUrl?: string | null;
    headshotUrl?: string | null;
  } | null;
}

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
  items?: {
    edges?: { node: ListItemNode }[];
  };
}

function extractPosterUrls(list: ListNode): string[] {
  const edges = list.items?.edges;
  if (!edges) return [];

  return edges.reduce<string[]>((urls, { node }) => {
    const item = node.item;
    if (!item) return urls;
    const url = item.posterUrl || item.venueImageUrl || item.headshotUrl;
    if (url) urls.push(url);
    return urls;
  }, []);
}

interface ListGridProps {
  lists: ListNode[];
  loading: boolean;
  emptyMessage?: string;
}

export function ListGrid({ lists, loading, emptyMessage = "No lists found." }: ListGridProps) {
  if (loading) {
    return (
      <div className="grid grid-cols-1 gap-x-[var(--spacing-6)] gap-y-[var(--spacing-4)] md:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <ListCardSkeleton key={i} />
        ))}
      </div>
    );
  }

  if (lists.length === 0) {
    return (
      <div className="empty-state">
        <p className="font-display text-base font-bold uppercase mb-1.5 text-curtn-cream">No Lists</p>
        <p className="text-xs text-curtn-muted max-w-[260px] mx-auto">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-x-[var(--spacing-6)] gap-y-[var(--spacing-4)] md:grid-cols-2 lg:grid-cols-3">
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
          posterUrls={extractPosterUrls(l)}
        />
      ))}
    </div>
  );
}
