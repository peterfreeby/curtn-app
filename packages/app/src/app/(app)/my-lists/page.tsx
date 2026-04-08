"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { MY_LISTS_QUERY } from "@/lib/graphql/lists";
import { ListGrid } from "@/components/lists/ListGrid";
import { InfiniteScrollSentinel } from "@/components/InfiniteScrollSentinel";
import { usePaginatedConnection } from "@/hooks/usePaginatedConnection";
import { useAuth } from "@/lib/auth/useAuth";
import { Icon } from "@/components/icons/Icons";

const LIST_TYPE_OPTIONS = [
  { value: "", label: "All" },
  { value: "shows", label: "Shows" },
  { value: "venues", label: "Venues" },
  { value: "runs", label: "Runs" },
  { value: "performances", label: "Performances" },
  { value: "people", label: "People" },
];

function ListsBrowser() {
  const { user } = useAuth();
  const [typeFilter, setTypeFilter] = useState("");

  const { edges, loading, loadingMore, hasNextPage, sentinelRef } =
    usePaginatedConnection({
      query: MY_LISTS_QUERY,
      variables: { listType: typeFilter || undefined },
      pageSize: 20,
      pause: !user,
      getConnection: (data: any) => data?.myLists,
    });

  const lists = edges.map((e: any) => e.node);

  return (
    <>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          {LIST_TYPE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setTypeFilter(opt.value)}
              className={`px-3 py-1 text-xs uppercase tracking-wider transition-colors cursor-pointer ${
                typeFilter === opt.value
                  ? "bg-curtn-coral text-curtn-deep"
                  : "border border-curtn-dark text-curtn-muted hover:border-curtn-muted/50 hover:text-curtn-cream"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <Link
          href="/my-lists/new"
          className="flex items-center gap-1.5 bg-curtn-coral px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-curtn-deep transition-colors hover:bg-curtn-red"
        >
          <Icon name="plus" size={14} />
          New List
        </Link>
      </div>

      {!user ? (
        <div className="empty-state">
          <p className="font-display text-base font-bold uppercase mb-1.5 text-curtn-cream">Sign In to Create Lists</p>
          <p className="text-xs text-curtn-muted max-w-[260px] mx-auto">
            Lists let you organize and share your favorite shows, venues, and more.
          </p>
        </div>
      ) : (
        <>
          <ListGrid
            lists={lists}
            loading={loading}
            emptyMessage="No lists yet. Create your first one!"
          />
          <InfiniteScrollSentinel
            sentinelRef={sentinelRef}
            loadingMore={loadingMore}
            hasNextPage={hasNextPage}
          />
        </>
      )}
    </>
  );
}

export default function ListsPage() {
  return (
    <div className="px-6 py-8 max-w-6xl mx-auto">
      <h2 className="text-xs uppercase tracking-widest text-curtn-muted mb-6">
        My Lists
      </h2>
      <Suspense
        fallback={
          <div className="mt-6">
            <ListGrid lists={[]} loading={true} />
          </div>
        }
      >
        <ListsBrowser />
      </Suspense>
    </div>
  );
}
