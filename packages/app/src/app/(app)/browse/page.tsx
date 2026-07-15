"use client";

import { Suspense, useState, useRef, useEffect, useCallback, Children, type ReactNode } from "react";
import { useQuery } from "urql";
import Link from "next/link";
import { EDITORIAL_LISTS_QUERY } from "@/lib/graphql/lists";
import { SHOW_LIST_QUERY } from "@/lib/graphql/shows";
import { ShowGrid } from "@/components/shows/ShowGrid";
import { PosterCard } from "@/components/PosterCard";
import { WiredPosterCard } from "@/components/WiredPosterCard";
import { toCastHeadshots } from "@/components/MondrianPoster";
import { Icon } from "@/components/icons/Icons";
import { useNearbyMetroState } from "@/lib/location/useNearbyMetro";

const PAGE_SIZE = 12;

// Above this many posters, the shelf stacks into two rows (then scrolls sideways);
// shorter shelves stay a single row.
const TWO_ROW_THRESHOLD = 6;

// A shelf is treated as portrait-dominant (→ single full-height row) once this
// fraction of its measured images are taller than they are wide.
const PORTRAIT_SHELF_FRACTION = 0.6;

type ShelfOrientation = "unknown" | "portrait" | "wide";

// Source-entity type → detail-page route segment.
const ENTITY_PATH: Record<string, string> = {
  venue: "venues",
  person: "people",
  productionCompany: "companies",
};

// "See all" target: entity-sourced lists link to that entity's detail page
// (e.g. "Shows at Caveat" → the Caveat venue page); others link to the list page.
function seeAllHref(list: any): string {
  if (list.sourceMode === "entity" && list.sourceEntityType && list.sourceEntitySlug) {
    const base = ENTITY_PATH[list.sourceEntityType];
    if (base) return `/${base}/${list.sourceEntitySlug}`;
  }
  return `/u/${list.owner.username}/lists/${list.slug}`;
}

function BrowseCarousel({ children }: { children: ReactNode }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [orientation, setOrientation] = useState<ShelfOrientation>("unknown");
  const [canLeft, setCanLeft] = useState(false);
  const [canRight, setCanRight] = useState(false);
  const childArray = Children.toArray(children);

  // Portrait-dominant shelves (e.g. a venue that's all poster art) render as one
  // full-height row instead of the double-stack, which would otherwise squeeze
  // each portrait card into a sliver. Everything else keeps the count-based split.
  const twoRows =
    orientation === "portrait" ? false : childArray.length > TWO_ROW_THRESHOLD;

  // We can't know image orientation until the browser loads them (no dimensions
  // in the data), so measure the rendered <img> natural sizes — which are
  // intrinsic, independent of how CSS is currently sizing the card — and decide
  // once they've all settled. Container height is h-56 in both modes, so any
  // resulting switch reflows inside the shelf without shifting the page.
  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;
    // Exclude Mondrian tile headshots — they're decorative, not the poster image
    // whose orientation should drive the shelf layout.
    const imgs = Array.from(
      container.querySelectorAll<HTMLImageElement>("img:not([data-mondrian-tile])"),
    );
    if (imgs.length === 0) return; // all-text shelf → leave to count-based split

    let settled = 0;
    const ratios: number[] = [];
    let cancelled = false;
    const cleanups: Array<() => void> = [];

    const decide = () => {
      if (cancelled || settled < imgs.length) return;
      if (ratios.length === 0) return setOrientation("wide");
      const portrait = ratios.filter((r) => r < 1).length;
      setOrientation(
        portrait / ratios.length >= PORTRAIT_SHELF_FRACTION ? "portrait" : "wide",
      );
    };

    imgs.forEach((img) => {
      const record = () => {
        settled += 1;
        if (img.naturalWidth > 0 && img.naturalHeight > 0) {
          ratios.push(img.naturalWidth / img.naturalHeight);
        }
        decide();
      };
      if (img.complete) {
        record();
      } else {
        img.addEventListener("load", record, { once: true });
        img.addEventListener("error", record, { once: true });
        cleanups.push(() => {
          img.removeEventListener("load", record);
          img.removeEventListener("error", record);
        });
      }
    });

    return () => {
      cancelled = true;
      cleanups.forEach((fn) => fn());
    };
  }, [childArray.length]);

  // Show an edge arrow only when there's somewhere to scroll that way: the left
  // arrow appears once you've moved off the start, the right arrow hides at the end.
  const updateArrows = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const { scrollLeft, scrollWidth, clientWidth } = el;
    const max = scrollWidth - clientWidth;
    setCanLeft(scrollLeft > 1);
    setCanRight(scrollLeft < max - 1);
  }, []);

  // Recompute on scroll, on viewport resize (container), and on content resize
  // (contentRef) — the latter catches images loading and the single/double-row
  // switch, both of which change scrollWidth. Re-runs when the layout mode flips
  // so it re-observes the freshly mounted content element.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.addEventListener("scroll", updateArrows, { passive: true });
    const ro = new ResizeObserver(updateArrows);
    ro.observe(el);
    if (contentRef.current) ro.observe(contentRef.current);
    updateArrows();
    return () => {
      el.removeEventListener("scroll", updateArrows);
      ro.disconnect();
    };
  }, [updateArrows, twoRows, childArray.length]);

  function scrollByPage(dir: -1 | 1) {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * el.clientWidth * 0.85, behavior: "smooth" });
  }

  // Each card: uniform height (h-56), width follows the poster's aspect ratio.
  const renderItem = (child: ReactNode, i: number) => (
    <div key={i} className="relative shrink-0 h-full">
      {child}
    </div>
  );

  const arrowBase =
    "absolute top-1/2 z-20 -translate-y-1/2 flex h-8 w-8 items-center justify-center rounded-full bg-curtn-deep/70 text-curtn-cream backdrop-blur-sm border border-curtn-cream/10 shadow-lg cursor-pointer opacity-0 transition-opacity duration-200 group-hover/carousel:opacity-100 focus-visible:opacity-100 hover:bg-curtn-deep";

  // A relative shell holds the scroll container plus the two floating edge arrows.
  // The arrows are siblings of (not inside) the scroller, so overflow-x doesn't
  // clip them, and they sit at the shell's edges = aligned with the card row.
  return (
    <div className="relative group/carousel">
      {/* One horizontal scroll container. Few posters → a single flex row. More →
          two independent flex rows stacked (each packs its own variable-width cards
          tightly, uniform height); w-max lets the rows extend and the container scroll. */}
      <div
        ref={scrollRef}
        className="overflow-x-auto pb-2 -mx-6 px-6 scrollbar-hide"
      >
        {twoRows ? (
          // Whole shelf = one playbill tall (h-56); the two rows split that height,
          // so two stacked cards equal a single full-height poster.
          <div ref={contentRef} className="flex h-56 w-max flex-col gap-[var(--spacing-2)]">
            {[0, 1].map((row) => (
              <div key={row} className="flex min-h-0 flex-1 gap-[var(--spacing-2)]">
                {childArray.map((child, i) => (i % 2 === row ? renderItem(child, i) : null))}
              </div>
            ))}
          </div>
        ) : (
          <div ref={contentRef} className="flex h-56 w-max gap-[var(--spacing-2)]">
            {childArray.map((child, i) => renderItem(child, i))}
          </div>
        )}
      </div>

      {canLeft && (
        <button
          type="button"
          onClick={() => scrollByPage(-1)}
          aria-label="Scroll left"
          className={`${arrowBase} left-1`}
        >
          <Icon name="caret-left" size={16} weight="bold" />
        </button>
      )}
      {canRight && (
        <button
          type="button"
          onClick={() => scrollByPage(1)}
          aria-label="Scroll right"
          className={`${arrowBase} right-1`}
        >
          <Icon name="caret-right" size={16} weight="bold" />
        </button>
      )}
    </div>
  );
}

function EditorialCarousel() {
  // Prompts for location on mount; resolves to the user's nearest metro's state
  // code (e.g. "NY"), or null while pending / if denied (→ show everything).
  const metroState = useNearbyMetroState();

  const [{ data, fetching }] = useQuery({
    query: EDITORIAL_LISTS_QUERY,
    variables: { activeOnly: true, first: 200 },
  });

  const allLists = data?.editorialLists?.edges?.map((e: any) => e.node) ?? [];

  // Resolve a list's item nodes, applying the location filter to venue lists:
  // when we know the user's metro, only surface featured venues in that state.
  const itemsForList = (list: any): any[] => {
    let items = list.items?.edges?.map((e: any) => e.node) ?? [];
    if (metroState && list.listType === "venues") {
      items = items.filter((node: any) => node.item?.state === metroState);
    }
    return items;
  };

  // Pair each list with its (possibly filtered) items, then drop any that end up
  // empty — covers empty manual lists, dynamic lists that resolve to nothing, and
  // venue lists with no featured venues near the user.
  const lists = allLists
    .map((list: any) => ({ list, items: itemsForList(list) }))
    .filter((entry: { items: any[] }) => entry.items.length > 0);

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
      {lists.map(({ list, items }: { list: any; items: any[] }) => {
        return (
          <section key={list.id}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-display text-sm font-bold uppercase tracking-wider text-curtn-cream">
                {list.name}
              </h3>
              <Link
                href={seeAllHref(list)}
                className="text-[10px] uppercase tracking-wider text-curtn-muted hover:text-curtn-coral transition-colors"
              >
                See all
              </Link>
            </div>

            {list.description && (
              <p className="text-xs text-curtn-muted mb-3 -mt-2">{list.description}</p>
            )}

            <BrowseCarousel>
              {items.map((item: any) => (
                <BrowseItemCard key={item.id} item={item.item} listType={list.listType} />
              ))}
            </BrowseCarousel>
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
        imageUrl={item.posterUrl}
        title={item.showTitle}
        href={`/performances/${encodeURIComponent(item.showId)}`}
        size="md"
        castHeadshots={
          item.posterUrl ? undefined : toCastHeadshots(item.castHeadshots)
        }
        fitHeight
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
        fitHeight
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
        fitHeight
      />
    );
  }

  // Fallback for runs/performances
  return (
    <PosterCard
      title={item.runTitle || item.date || "Item"}
      size="md"
      fitHeight
    />
  );
}

function ShowsBrowser() {
  const [after, setAfter] = useState<string | null>(null);
  const [prevEdges, setPrevEdges] = useState<any[]>([]);
  const sentinelRef = useRef<HTMLDivElement>(null);

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

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;
    if (result.fetching) return;
    if (!pageInfo?.hasNextPage || !pageInfo.endCursor) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setPrevEdges(allEdges);
          setAfter(pageInfo.endCursor!);
        }
      },
      { rootMargin: "600px" }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [result.fetching, pageInfo?.hasNextPage, pageInfo?.endCursor, allEdges]);

  return (
    <>
      <ShowGrid shows={shows} loading={result.fetching && after === null} />

      {pageInfo?.hasNextPage && (
        <div ref={sentinelRef} className="mt-6 flex justify-center" aria-hidden>
          {result.fetching && after !== null && (
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-curtn-muted/30 border-t-curtn-coral" />
          )}
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
