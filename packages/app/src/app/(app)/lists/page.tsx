"use client";

import { Suspense } from "react";
import { useQuery } from "urql";
import { EDITORIAL_LISTS_QUERY } from "@/lib/graphql/lists";
import { ListGrid } from "@/components/lists/ListGrid";

function FeaturedLists() {
  const [{ data, fetching }] = useQuery({
    query: EDITORIAL_LISTS_QUERY,
    variables: { activeOnly: true },
  });

  const lists = data?.editorialLists?.edges?.map((e: any) => e.node) ?? [];

  return (
    <ListGrid
      lists={lists}
      loading={fetching}
      emptyMessage="No featured lists at the moment."
    />
  );
}

export default function ListsPage() {
  return (
    <div className="px-6 py-8 max-w-6xl mx-auto space-y-12">
      <section>
        <div className="flex items-center justify-between border-b border-curtn-dark/50 pb-2 mb-6">
          <h2 className="text-sm font-display font-semibold uppercase tracking-widest text-curtn-muted hover:text-curtn-cream transition-colors">
            Featured Lists
          </h2>
        </div>
        
        <Suspense
          fallback={
            <div className="mt-6">
              <ListGrid lists={[]} loading={true} />
            </div>
          }
        >
          <FeaturedLists />
        </Suspense>
      </section>
    </div>
  );
}
