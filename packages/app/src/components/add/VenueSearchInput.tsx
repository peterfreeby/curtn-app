"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useQuery } from "urql";
import { SEARCH_VENUES_QUERY } from "@/lib/graphql/venues";

interface VenueResult {
  id: string;
  name: string;
  city: string;
}

interface VenueSearchInputProps {
  onSelect: (venue: VenueResult) => void;
}

export function VenueSearchInput({ onSelect }: VenueSearchInputProps) {
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    timerRef.current = setTimeout(() => setDebouncedQuery(query), 200);
    return () => clearTimeout(timerRef.current);
  }, [query]);

  const [{ data, fetching }] = useQuery({
    query: SEARCH_VENUES_QUERY,
    variables: { search: debouncedQuery, first: 8 },
    pause: debouncedQuery.length < 2,
  });

  const results: VenueResult[] =
    data?.venueList?.edges?.map((e: any) => e.node) ?? [];

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelect = useCallback(
    (venue: VenueResult) => {
      setQuery(venue.name);
      setIsOpen(false);
      onSelect(venue);
    },
    [onSelect]
  );

  return (
    <div ref={containerRef} className="relative">
      <label
        htmlFor="venue-search"
        className="text-xs uppercase tracking-widest text-curtn-muted mb-2 block"
      >
        Venue
      </label>
      <input
        id="venue-search"
        type="text"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setIsOpen(true);
        }}
        onFocus={() => query.length >= 2 && setIsOpen(true)}
        placeholder="Search for a venue..."
        className="w-full bg-transparent border-b border-curtn-dark text-curtn-cream placeholder:text-curtn-dark py-2 text-sm outline-none focus:border-curtn-coral transition-colors duration-200"
        autoComplete="off"
      />
      {isOpen && debouncedQuery.length >= 2 && (
        <div className="absolute z-50 mt-1 w-full border border-curtn-dark/50 bg-curtn-surface shadow-xl max-h-64 overflow-y-auto dog-ear dog-ear-sm">
          {fetching && (
            <div className="px-4 py-3 text-sm text-curtn-muted">
              Searching...
            </div>
          )}
          {!fetching && results.length === 0 && (
            <div className="px-4 py-3 text-sm text-curtn-muted">
              No venues found.
            </div>
          )}
          {!fetching &&
            results.map((venue) => (
              <button
                key={venue.id}
                type="button"
                onClick={() => handleSelect(venue)}
                className="w-full text-left px-4 py-3 text-sm hover:bg-curtn-dark/30 transition-colors cursor-pointer"
              >
                <span className="text-curtn-cream font-medium">
                  {venue.name}
                </span>
                {venue.city && (
                  <span className="text-curtn-muted ml-2 text-xs">
                    {venue.city}
                  </span>
                )}
              </button>
            ))}
        </div>
      )}
    </div>
  );
}
