"use client";

import { Suspense, useState } from "react";
import { useQuery } from "urql";
import Link from "next/link";
import { EDITORIAL_LISTS_QUERY } from "@/lib/graphql/lists";
import { SHOW_LIST_QUERY } from "@/lib/graphql/shows";
import { ShowGrid } from "@/components/shows/ShowGrid";
import { Icon } from "@/components/icons/Icons";

const PAGE_SIZE = 12;

function EditorialCarousel() {
  const [{ data, fetching }] = useQuery({
    query: EDITORIAL_LISTS_QUERY,
    variables: { activeOnly: true },
  });

  const lists = data?.editorialLists?.edges?.map((e: any) => e.node) ?? [];

  if (fetching) {
    return (
      <div className="space-y-10">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i}>
            <div className="h-4 w-40 bg-curtn-dark/30 animate-pulse mb-4" />
            <div className="flex gap-[var(--spacing-2)] overflow-hidden">
              {Array.from({ length: 4 }).map((_, j) => (
                <div key={j} className="h-48 w-40 shrink-0 bg-curtn-dark/30 animate-pulse" />
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (lists.length === 0) return null;

  return (
    <div className="space-y-10">
      {lists.map((list: any) => {
        const items = list.items?.edges?.map((e: any) => e.node) ?? [];
        return (
          <section key={list.id}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-display text-sm font-bold uppercase tracking-wider text-curtn-cream">
                {list.name}
              </h3>
              <Link
                href={`/u/${list.owner.username}/lists/${list.slug}`}
                className="text-[10px] uppercase tracking-wider text-curtn-muted hover:text-curtn-coral transition-colors"
              >
                See all
              </Link>
            </div>

            {list.description && (
              <p className="text-xs text-curtn-muted mb-3 -mt-2">{list.description}</p>
            )}

            <div className="flex gap-[var(--spacing-2)] overflow-x-auto pb-2 -mx-6 px-6 scrollbar-hide">
              {items.map((item: any) => (
                <BrowseItemCard key={item.id} item={item.item} listType={list.listType} />
              ))}
              {items.length === 0 && (
                <p className="text-xs text-curtn-muted/50">No items in this list yet</p>
              )}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function BrowseItemCard({ item, listType }: { item: any; listType: string }) {
  if (!item) return null;

  if (listType === "shows") {
    return (
      <Link
        href={`/performances/${encodeURIComponent(item.showId)}`}
        className="group shrink-0 w-36 dog-ear border border-curtn-dark/50 bg-curtn-surface overflow-hidden transition-colors hover:border-curtn-muted/50"
      >
        <div className="aspect-[2/3] overflow-hidden bg-curtn-dark/20">
          {(item.posterUrl || item.imageUrl) ? (
            <img src={item.posterUrl || item.imageUrl} alt={item.showTitle} className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <Icon name="ticket" weight="thin" size={28} className="text-curtn-dark" />
            </div>
          )}
        </div>
        <div className="p-1.5">
          <p className="text-xs font-semibold text-curtn-cream line-clamp-2 leading-snug">{item.showTitle}</p>
        </div>
      </Link>
    );
  }

  if (listType === "venues") {
    return (
      <Link
        href={`/venues/${item.venueSlug}`}
        className="group shrink-0 w-48 dog-ear border border-curtn-dark/50 bg-curtn-surface overflow-hidden transition-colors hover:border-curtn-muted/50"
      >
        <div className="aspect-[16/9] overflow-hidden bg-curtn-dark/20">
          {item.venueImageUrl ? (
            <img src={item.venueImageUrl} alt={item.venueName} className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <Icon name="buildings" weight="thin" size={28} className="text-curtn-dark" />
            </div>
          )}
        </div>
        <div className="p-1.5">
          <p className="text-xs font-semibold text-curtn-cream line-clamp-1">{item.venueName}</p>
          <p className="text-[10px] text-curtn-muted truncate">{item.city}, {item.state}</p>
        </div>
      </Link>
    );
  }

  if (listType === "people") {
    return (
      <Link
        href={`/people/${item.personSlug}`}
        className="group shrink-0 w-32 text-center transition-colors"
      >
        <div className="mx-auto h-20 w-20 overflow-hidden rounded-full bg-curtn-dark/20">
          {item.headshotUrl ? (
            <img src={item.headshotUrl} alt={item.personName} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <Icon name="user" weight="thin" size={28} className="text-curtn-dark" />
            </div>
          )}
        </div>
        <p className="mt-2 text-xs font-semibold text-curtn-cream line-clamp-2 group-hover:text-curtn-coral transition-colors">{item.personName}</p>
      </Link>
    );
  }

  // Fallback for runs/performances
  return (
    <div className="shrink-0 w-48 dog-ear border border-curtn-dark/50 bg-curtn-surface p-2">
      <p className="text-xs text-curtn-cream">{item.runTitle || item.date || "Item"}</p>
    </div>
  );
}

function ShowsBrowser() {
  const [after, setAfter] = useState<string | null>(null);
  const [prevEdges, setPrevEdges] = useState<any[]>([]);

  const [result] = useQuery({
    query: SHOW_LIST_QUERY,
    variables: {
      first: PAGE_SIZE,
      after,
    },
  });

  const connection = result.data?.showList;
  const currentEdges = connection?.edges ?? [];
  const pageInfo = connection?.pageInfo;
  const allEdges = after === null ? currentEdges : [...prevEdges, ...currentEdges];
  const shows = allEdges.map((e: any) => e.node);

  function handleLoadMore() {
    if (pageInfo?.endCursor) {
      setPrevEdges(allEdges);
      setAfter(pageInfo.endCursor);
    }
  }

  return (
    <>
      <ShowGrid shows={shows} loading={result.fetching && after === null} />

      {!result.fetching && pageInfo?.hasNextPage && (
        <div className="mt-6 flex justify-center">
          <button
            type="button"
            onClick={handleLoadMore}
            className="border border-curtn-dark px-6 py-2.5 text-sm text-curtn-muted transition-colors hover:border-curtn-muted/50 hover:text-curtn-cream"
          >
            Load more
          </button>
        </div>
      )}

      {result.fetching && after !== null && (
        <div className="mt-6 flex justify-center">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-curtn-muted/30 border-t-curtn-coral" />
        </div>
      )}
    </>
  );
}

export default function BrowsePage() {
  return (
    <div className="px-6 py-8 max-w-6xl mx-auto">
      <h2 className="text-xs uppercase tracking-widest text-curtn-muted mb-6">
        Browse
      </h2>

      <Suspense
        fallback={
          <div className="space-y-10">
            {Array.from({ length: 2 }).map((_, i) => (
              <div key={i}>
                <div className="h-4 w-40 bg-curtn-dark/30 animate-pulse mb-4" />
                <div className="flex gap-[var(--spacing-2)] overflow-hidden">
                  {Array.from({ length: 4 }).map((_, j) => (
                    <div key={j} className="h-48 w-40 shrink-0 bg-curtn-dark/30 animate-pulse" />
                  ))}
                </div>
              </div>
            ))}
          </div>
        }
      >
        <EditorialCarousel />
      </Suspense>

      <section className="mt-12">
        <h3 className="font-display text-sm font-bold uppercase tracking-wider text-curtn-cream mb-4">
          All Shows
        </h3>
        <Suspense
          fallback={<ShowGrid shows={[]} loading={true} />}
        >
          <ShowsBrowser />
        </Suspense>
      </section>
    </div>
  );
}
