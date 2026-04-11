"use client";

import { useState, useMemo, useEffect, useRef, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useQuery } from "urql";
import Link from "next/link";
import { Icon } from "@/components/icons/Icons";
import {
  SEARCH_ALL_SHOWS_QUERY,
  SEARCH_ALL_VENUES_QUERY,
  SEARCH_ALL_PEOPLE_QUERY,
  SEARCH_ALL_COMPANIES_QUERY,
} from "@/lib/graphql/search";

const RESULT_LIMIT = 8;

function useDebounce(value: string, ms: number) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return debounced;
}

/** Score 0–1 for how close `name` is to an exact match of `query`. */
function exactness(name: string, query: string): number {
  const n = name.toLowerCase();
  const q = query.toLowerCase();
  if (n === q) return 1;
  if (n.startsWith(q)) return 0.8;
  if (n.includes(q)) return 0.5;
  return 0;
}

interface ResultGroup {
  key: string;
  label: string;
  icon: "ticket" | "buildings" | "user" | "globe";
  score: number;
  items: React.ReactNode[];
}

function SearchContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);

  const urlQ = searchParams.get("q") ?? "";
  const [input, setInput] = useState(urlQ);
  const query = useDebounce(input, 250);
  const hasQuery = query.length >= 2;

  // Sync input from URL param (when floating bar updates it)
  useEffect(() => {
    if (urlQ !== input) {
      setInput(urlQ);
    }
  }, [urlQ]);

  // Auto-focus the input on mount (desktop only)
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Sync query param back to URL (desktop input changes)
  useEffect(() => {
    // Only sync if the query differs from current URL to avoid loops
    const currentQ = searchParams.get("q") ?? "";
    if (query !== currentQ) {
      const params = new URLSearchParams(searchParams.toString());
      if (query) params.set("q", query);
      else params.delete("q");
      router.replace(`/search?${params.toString()}`, { scroll: false });
    }
  }, [query]);

  const [showsResult] = useQuery({
    query: SEARCH_ALL_SHOWS_QUERY,
    variables: { query, first: RESULT_LIMIT },
    pause: !hasQuery,
  });
  const [venuesResult] = useQuery({
    query: SEARCH_ALL_VENUES_QUERY,
    variables: { search: query, first: RESULT_LIMIT },
    pause: !hasQuery,
  });
  const [peopleResult] = useQuery({
    query: SEARCH_ALL_PEOPLE_QUERY,
    variables: { search: query, first: RESULT_LIMIT },
    pause: !hasQuery,
  });
  const [companiesResult] = useQuery({
    query: SEARCH_ALL_COMPANIES_QUERY,
    variables: { search: query, first: RESULT_LIMIT },
    pause: !hasQuery,
  });

  const fetching =
    showsResult.fetching ||
    venuesResult.fetching ||
    peopleResult.fetching ||
    companiesResult.fetching;

  const groups = useMemo<ResultGroup[]>(() => {
    if (!hasQuery) return [];

    const shows = showsResult.data?.searchShows?.edges ?? [];
    const venues = venuesResult.data?.venueList?.edges ?? [];
    const people = peopleResult.data?.personList?.edges ?? [];
    const companies =
      companiesResult.data?.productionCompanyList?.edges ?? [];

    const result: ResultGroup[] = [];

    if (shows.length > 0) {
      const bestScore = Math.max(
        ...shows.map((e: any) => exactness(e.node.title, query))
      );
      result.push({
        key: "shows",
        label: "Shows",
        icon: "ticket",
        score: bestScore,
        items: shows.map((e: any) => {
          const s = e.node;
          const run = s.runs?.edges?.[0]?.node;
          return (
            <SearchRow
              key={s.id}
              href={`/performances/${s.id}`}
              title={s.title}
              meta={[
                s.performanceTypes?.[0],
                run?.productionCompany?.name,
                run?.venues?.[0]?.city,
              ]}
              trailing={
                s.averageRating != null
                  ? `${s.averageRating.toFixed(1)} · ${s.reviewCount}`
                  : s.reviewCount > 0
                  ? `${s.reviewCount} reviews`
                  : undefined
              }
            />
          );
        }),
      });
    }

    if (venues.length > 0) {
      const bestScore = Math.max(
        ...venues.map((e: any) => exactness(e.node.name, query))
      );
      result.push({
        key: "venues",
        label: "Theaters",
        icon: "buildings",
        score: bestScore,
        items: venues.map((e: any) => {
          const v = e.node;
          return (
            <SearchRow
              key={v.id}
              href={`/venues/${v.slug}`}
              title={v.name}
              meta={[
                v.venueType,
                [v.city, v.state].filter(Boolean).join(", "),
              ]}
            />
          );
        }),
      });
    }

    if (people.length > 0) {
      const bestScore = Math.max(
        ...people.map((e: any) => exactness(e.node.name, query))
      );
      result.push({
        key: "people",
        label: "People",
        icon: "user",
        score: bestScore,
        items: people.map((e: any) => {
          const p = e.node;
          return (
            <SearchRow
              key={p.id}
              href={`/people/${p.slug}`}
              title={p.name}
            />
          );
        }),
      });
    }

    if (companies.length > 0) {
      const bestScore = Math.max(
        ...companies.map((e: any) => exactness(e.node.name, query))
      );
      result.push({
        key: "companies",
        label: "Companies",
        icon: "globe",
        score: bestScore,
        items: companies.map((e: any) => {
          const c = e.node;
          return (
            <SearchRow
              key={c.id}
              href={`/companies/${c.slug}`}
              title={c.name}
            />
          );
        }),
      });
    }

    // Sort groups: highest exactness score first
    result.sort((a, b) => b.score - a.score);
    return result;
  }, [hasQuery, query, showsResult.data, venuesResult.data, peopleResult.data, companiesResult.data]);

  const totalResults = groups.reduce((sum, g) => sum + g.items.length, 0);

  return (
    <div className="px-4 sm:px-6 py-8 max-w-2xl mx-auto">
      {/* Search input */}
      <div className="relative hidden md:block">
        <Icon
          name="magnifying-glass"
          size={18}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-curtn-muted pointer-events-none"
        />
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Search shows, theaters, people, companies..."
          className="w-full bg-curtn-surface border border-curtn-dark/50 pl-10 pr-4 py-3 text-sm text-curtn-cream placeholder:text-curtn-muted/50 focus:outline-none focus:border-curtn-muted/50 transition-colors"
        />
        {input && (
          <button
            type="button"
            onClick={() => setInput("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-curtn-muted hover:text-curtn-cream transition-colors"
            aria-label="Clear search"
          >
            <span className="text-lg leading-none">&times;</span>
          </button>
        )}
      </div>

      {/* Results */}
      <div className="mt-6">
        {!hasQuery && (
          <p className="text-sm text-curtn-muted/60 text-center py-12">
            Start typing to search
          </p>
        )}

        {hasQuery && fetching && totalResults === 0 && (
          <div className="flex justify-center py-12">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-curtn-muted/30 border-t-curtn-coral" />
          </div>
        )}

        {hasQuery && !fetching && totalResults === 0 && (
          <p className="text-sm text-curtn-muted/60 text-center py-12">
            No results for &ldquo;{query}&rdquo;
          </p>
        )}

        {groups.map((group) => (
          <section key={group.key} className="mb-8">
            <div className="flex items-center gap-2 mb-3">
              <Icon
                name={group.icon}
                size={14}
                className="text-curtn-muted/70"
              />
              <h3 className="text-[11px] font-display uppercase tracking-widest text-curtn-muted">
                {group.label}
              </h3>
            </div>
            <div className="border border-curtn-dark/50 divide-y divide-curtn-dark/30">
              {group.items}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

export default function SearchPage() {
  return (
    <Suspense fallback={
      <div className="px-4 sm:px-6 py-8 max-w-2xl mx-auto flex justify-center">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-curtn-muted/30 border-t-curtn-coral" />
      </div>
    }>
      <SearchContent />
    </Suspense>
  );
}

function SearchRow({
  href,
  title,
  meta,
  trailing,
}: {
  href: string;
  title: string;
  meta?: (string | undefined | null)[];
  trailing?: string;
}) {
  const metaStr = meta?.filter(Boolean).join(" · ");

  return (
    <Link
      href={href}
      className="flex items-center justify-between px-4 py-3 bg-curtn-surface hover:bg-curtn-surface-2 transition-colors duration-150"
    >
      <div className="min-w-0">
        <p className="text-sm font-medium text-curtn-cream truncate">
          {title}
        </p>
        {metaStr && (
          <p className="text-xs text-curtn-muted/70 truncate mt-0.5">
            {metaStr}
          </p>
        )}
      </div>
      {trailing && (
        <span className="ml-4 shrink-0 text-xs text-curtn-muted/60 flex items-center gap-1">
          <Icon name="star" weight="fill" size={12} className="text-curtn-coral" />
          {trailing}
        </span>
      )}
    </Link>
  );
}
