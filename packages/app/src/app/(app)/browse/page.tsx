"use client";

import { Suspense, useState, useRef, useEffect, useCallback, Children, type ReactNode } from "react";
import { useQuery } from "urql";
import Link from "next/link";
import { EDITORIAL_LISTS_QUERY } from "@/lib/graphql/lists";
import { SHOW_LIST_QUERY } from "@/lib/graphql/shows";
import { ShowGrid } from "@/components/shows/ShowGrid";
import { PosterCard } from "@/components/PosterCard";
import { WiredPosterCard } from "@/components/WiredPosterCard";
import { Icon } from "@/components/icons/Icons";

const PAGE_SIZE = 12;
const SCROLL_PADDING = 24; // matches px-6

type PeekSide = "left" | "right";

function BrowseCarousel({ children }: { children: ReactNode }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [peekMap, setPeekMap] = useState<Map<number, PeekSide>>(new Map());
  const childArray = Children.toArray(children);

  const updatePeek = useCallback(() => {
    const container = scrollRef.current;
    if (!container) return;

    const cRect = container.getBoundingClientRect();
    const viewLeft = cRect.left + SCROLL_PADDING;
    const viewRight = cRect.right;

    const next = new Map<number, PeekSide>();
    itemRefs.current.forEach((el, i) => {
      if (!el) return;
      const r = el.getBoundingClientRect();
      // Off-screen entirely — skip
      if (r.right <= viewLeft || r.left >= viewRight) return;
      // Fully visible — skip
      if (r.left >= viewLeft - 1 && r.right <= viewRight + 1) return;
      // Partially visible
      next.set(i, r.left < viewLeft ? "left" : "right");
    });
    setPeekMap(next);
  }, []);

  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;
    container.addEventListener("scroll", updatePeek, { passive: true });
    const ro = new ResizeObserver(updatePeek);
    ro.observe(container);
    updatePeek();
    return () => {
      container.removeEventListener("scroll", updatePeek);
      ro.disconnect();
    };
  }, [updatePeek, childArray.length]);

  function scrollToItem(index: number) {
    const container = scrollRef.current;
    const el = itemRefs.current[index];
    if (!container || !el) return;
    const elRect = el.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();
    const target = container.scrollLeft + (elRect.left - containerRect.left) - SCROLL_PADDING;
    container.scrollTo({ left: target, behavior: "smooth" });
  }

  return (
    <div
      ref={scrollRef}
      className="flex gap-[var(--spacing-2)] overflow-x-auto pb-2 -mx-6 px-6 scrollbar-hide"
    >
      {childArray.map((child, i) => {
        const side = peekMap.get(i);
        return (
          <div
            key={i}
            ref={(el) => { itemRefs.current[i] = el; }}
            className="relative shrink-0"
          >
            {child}
            {side && (
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  scrollToItem(i);
                }}
                className={`group/peek absolute inset-0 z-10 flex items-center cursor-pointer ${
                  side === "left" ? "justify-end" : "justify-start"
                }`}
                aria-label={side === "left" ? "Scroll left" : "Scroll right"}
              >
                <div className="absolute inset-0 bg-curtn-deep/40 opacity-0 group-hover/peek:opacity-100 transition-opacity duration-200" />
                <Icon
                  name={side === "left" ? "caret-left" : "caret-right"}
                  size={24}
                  weight="bold"
                  className="text-curtn-cream opacity-0 group-hover/peek:opacity-100 transition-opacity duration-200 relative mx-2"
                />
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}

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

            {items.length > 0 ? (
              <BrowseCarousel>
                {items.map((item: any) => (
                  <BrowseItemCard key={item.id} item={item.item} listType={list.listType} />
                ))}
              </BrowseCarousel>
            ) : (
              <p className="text-xs text-curtn-muted/50">No items in this list yet</p>
            )}
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
      <WiredPosterCard
        showId={item.showId}
        imageUrl={item.posterUrl || item.imageUrl}
        title={item.showTitle}
        href={`/performances/${encodeURIComponent(item.showId)}`}
        size="md"
        className="!w-36"
      />
    );
  }

  if (listType === "venues") {
    return (
      <PosterCard
        imageUrl={item.venueImageUrl}
        title={item.venueName}
        subtitle={`${item.city}, ${item.state}`}
        href={`/venues/${item.venueSlug}`}
        size="lg"
        className="!w-48"
      />
    );
  }

  if (listType === "people") {
    return (
      <PosterCard
        imageUrl={item.headshotUrl}
        title={item.personName}
        href={`/people/${item.personSlug}`}
        size="md"
        className="!w-32"
      />
    );
  }

  // Fallback for runs/performances
  return (
    <PosterCard
      title={item.runTitle || item.date || "Item"}
      size="md"
      className="!w-36"
    />
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
    <div className="px-2 sm:px-6 py-8 max-w-6xl mx-auto">
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
