"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useQuery } from "urql";
import { SEARCH_SHOWS_QUERY } from "@/lib/graphql/shows";

interface PerformanceResult {
  id: string;
  title: string;
  company: { name: string } | null;
}

interface PerformanceSearchProps {
  onSelect: (performance: PerformanceResult) => void;
}

export function PerformanceSearch({ onSelect }: PerformanceSearchProps) {
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Debounce search input
  useEffect(() => {
    timerRef.current = setTimeout(() => {
      setDebouncedQuery(query);
    }, 200);
    return () => clearTimeout(timerRef.current);
  }, [query]);

  const [{ data, fetching }] = useQuery({
    query: SEARCH_SHOWS_QUERY,
    variables: { query: debouncedQuery, first: 8 },
    pause: debouncedQuery.length < 2,
  });

  const results: PerformanceResult[] =
    data?.searchShows?.edges?.map((e: any) => ({
      id: e.node.id,
      title: e.node.title,
      company: e.node.runs?.edges?.[0]?.node?.productionCompany ?? null,
    })) ?? [];

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelect = useCallback(
    (p: PerformanceResult) => {
      setQuery(p.title);
      setIsOpen(false);
      onSelect(p);
    },
    [onSelect]
  );

  return (
    <div ref={containerRef} className="relative">
      <label
        htmlFor="performance-search"
        className="text-xs uppercase tracking-widest text-curtn-muted mb-2 block"
      >
        Performance
      </label>
      <input
        id="performance-search"
        type="text"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setIsOpen(true);
        }}
        onFocus={() => query.length >= 2 && setIsOpen(true)}
        placeholder="Search for a show..."
        className="w-full bg-transparent border-b border-curtn-dark text-curtn-cream placeholder:text-curtn-dark py-2 text-sm outline-none focus:border-curtn-coral transition-colors duration-200"
        autoComplete="off"
      />

      {isOpen && debouncedQuery.length >= 2 && (
        <div className="absolute z-50 mt-1 w-full rounded-lg border border-curtn-dark/50 bg-curtn-surface shadow-xl max-h-64 overflow-y-auto">
          {fetching && (
            <div className="px-4 py-3 text-sm text-curtn-muted">Searching...</div>
          )}
          {!fetching && results.length === 0 && (
            <div className="px-4 py-3 text-sm text-curtn-muted">No results found.</div>
          )}
          {!fetching &&
            results.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => handleSelect(p)}
                className="w-full text-left px-4 py-3 text-sm hover:bg-curtn-dark/30 transition-colors cursor-pointer"
              >
                <span className="text-curtn-cream font-medium">{p.title}</span>
                {p.company?.name && (
                  <span className="text-curtn-muted ml-2 text-xs">
                    {p.company.name}
                  </span>
                )}
              </button>
            ))}
        </div>
      )}
    </div>
  );
}
