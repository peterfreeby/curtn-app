"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useQuery, useMutation } from "urql";
import { SEARCH_VENUES_QUERY, VENUE_FIND_OR_CREATE_MUTATION } from "@/lib/graphql/venues";

interface VenueResult {
  id: string;
  name: string;
  city: string;
}

interface VenueSearchInputProps {
  onSelect: (venue: VenueResult) => void;
}

// Default coordinates per city (city center approximations)
const CITY_DEFAULTS: Record<string, { state: string; lat: number; lng: number }> = {
  NYC: { state: "NY", lat: 40.7128, lng: -74.006 },
  Minneapolis: { state: "MN", lat: 44.9778, lng: -93.265 },
  LA: { state: "CA", lat: 34.0522, lng: -118.2437 },
};

export function VenueSearchInput({ onSelect }: VenueSearchInputProps) {
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newAddress, setNewAddress] = useState("");
  const [newCity, setNewCity] = useState("NYC");
  const [createError, setCreateError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const [, createVenue] = useMutation(VENUE_FIND_OR_CREATE_MUTATION);

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
    (data?.venueList?.edges?.map((e: any) => e.node) ?? []).filter(Boolean);

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
      setIsCreating(false);
      onSelect(venue);
    },
    [onSelect]
  );

  const handleCreate = useCallback(async () => {
    if (!newName.trim() || !newAddress.trim()) return;
    setCreateError(null);

    const cityDefaults = CITY_DEFAULTS[newCity] || CITY_DEFAULTS.NYC;

    const result = await createVenue({
      input: {
        name: newName.trim(),
        address: newAddress.trim(),
        city: newCity,
        state: cityDefaults.state,
        latitude: cityDefaults.lat,
        longitude: cityDefaults.lng,
      },
    });

    const error = result.data?.venueFindOrCreate?.error;
    if (error) {
      setCreateError(error);
      return;
    }

    const venue = result.data?.venueFindOrCreate?.venue;
    if (venue) {
      setQuery(venue.name);
      setIsCreating(false);
      setIsOpen(false);
      setCreateError(null);
      onSelect(venue);
    }
  }, [newName, newAddress, newCity, createVenue, onSelect]);

  if (isCreating) {
    return (
      <div ref={containerRef} className="space-y-3">
        <label className="text-xs uppercase tracking-widest text-curtn-muted mb-2 block">
          New Venue
        </label>
        {createError && (
          <div className="text-xs text-curtn-red">{createError}</div>
        )}
        <input
          type="text"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="Venue name"
          className="w-full bg-transparent border-b border-curtn-dark text-curtn-cream placeholder:text-curtn-dark py-2 text-sm outline-none focus:border-curtn-coral transition-colors duration-200"
          autoFocus
        />
        <input
          type="text"
          value={newAddress}
          onChange={(e) => setNewAddress(e.target.value)}
          placeholder="Address (e.g. 563 Johnson Ave, Brooklyn)"
          className="w-full bg-transparent border-b border-curtn-dark text-curtn-cream placeholder:text-curtn-dark py-2 text-sm outline-none focus:border-curtn-coral transition-colors duration-200"
        />
        <div className="flex items-center gap-2">
          <select
            value={newCity}
            onChange={(e) => setNewCity(e.target.value)}
            className="bg-transparent border-b border-curtn-dark text-curtn-cream py-2 text-sm outline-none focus:border-curtn-coral transition-colors duration-200 [color-scheme:dark]"
          >
            <option value="NYC">NYC</option>
            <option value="Minneapolis">Minneapolis</option>
            <option value="LA">LA</option>
          </select>
        </div>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={handleCreate}
            disabled={!newName.trim() || !newAddress.trim()}
            className="text-xs font-medium text-curtn-coral hover:text-curtn-cream transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
          >
            Create Venue
          </button>
          <button
            type="button"
            onClick={() => {
              setIsCreating(false);
              setNewName("");
              setNewAddress("");
              setCreateError(null);
            }}
            className="text-xs text-curtn-muted hover:text-curtn-cream transition-colors cursor-pointer"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

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
          {!fetching && results.length === 0 && (
            <div className="px-4 py-3 text-sm text-curtn-muted">
              No venues found.
            </div>
          )}
          <button
            type="button"
            onClick={() => {
              setIsCreating(true);
              setNewName(query);
              setIsOpen(false);
            }}
            className="w-full text-left px-4 py-3 text-xs text-curtn-coral hover:bg-curtn-dark/30 transition-colors border-t border-curtn-dark/30 cursor-pointer"
          >
            Can&apos;t find it? Add a new venue
          </button>
        </div>
      )}
    </div>
  );
}
