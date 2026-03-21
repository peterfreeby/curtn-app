"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useQuery } from "urql";
import { SEARCH_SHOWS_QUERY } from "@/lib/graphql/shows";

interface ShowResult {
  id: string;
  title: string;
  runs?: {
    edges: {
      node: {
        id: string;
        productionCompany: { name: string; slug: string };
      };
    }[];
  };
}

interface ShowSearchProps {
  onSelect: (show: ShowResult) => void;
  canCreate?: boolean;
  onCreateNew?: (query: string) => void;
}

export function ShowSearch({ onSelect, canCreate = false, onCreateNew }: ShowSearchProps) {
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

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

  const results: ShowResult[] =
    data?.searchShows?.edges?.map((e: any) => e.node) ?? [];

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
    (show: ShowResult) => {
      setQuery(show.title);
      setIsOpen(false);
      onSelect(show);
    },
    [onSelect]
  );

  return (
    <div ref={containerRef} className="relative">
      <label
        htmlFor="show-search"
        className="text-xs uppercase tracking-widest text-curtn-muted mb-2 block"
      >
        Show
      </label>
      <input
        id="show-search"
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
        <div className="absolute z-50 mt-1 w-full border border-curtn-dark/50 bg-curtn-surface shadow-xl max-h-64 overflow-y-auto dog-ear dog-ear-sm">
          {fetching && (
            <div className="px-4 py-3 text-sm text-curtn-muted">Searching...</div>
          )}
          {!fetching && results.length === 0 && (
            <div className="px-4 py-3 text-sm text-curtn-muted">
              {canCreate ? (
                <>
                  No results found.{" "}
                  <button
                    type="button"
                    onClick={() => {
                      setIsOpen(false);
                      onCreateNew(query);
                    }}
                    className="text-curtn-coral hover:text-curtn-red transition-colors cursor-pointer underline"
                  >
                    Add it
                  </button>
                </>
              ) : (
                "No results found. Log 3 shows to unlock adding new ones."
              )}
            </div>
          )}
          {!fetching &&
            results.map((show) => {
              const companyName = show.runs?.edges?.[0]?.node?.productionCompany?.name;
              return (
                <button
                  key={show.id}
                  type="button"
                  onClick={() => handleSelect(show)}
                  className="w-full text-left px-4 py-3 text-sm hover:bg-curtn-dark/30 transition-colors cursor-pointer"
                >
                  <span className="text-curtn-cream font-medium">{show.title}</span>
                  {companyName && (
                    <span className="text-curtn-muted ml-2 text-xs">
                      {companyName}
                    </span>
                  )}
                </button>
              );
            })}
        </div>
      )}
    </div>
  );
}
