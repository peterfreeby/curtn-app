"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useQuery, useMutation } from "urql";
import { SEARCH_VENUES_QUERY, VENUE_FIND_OR_CREATE_MUTATION } from "@/lib/graphql/venues";

interface VenueResult {
  id: string;
  name: string;
  city: string;
}

interface VenueSearchProps {
  onSelect: (venue: VenueResult) => void;
  canCreate: boolean;
}

const CITY_OPTIONS = [
  { value: "NYC", label: "NYC", state: "NY" },
  { value: "Minneapolis", label: "Minneapolis", state: "MN" },
  { value: "LA", label: "LA", state: "CA" },
] as const;

export function VenueSearch({ onSelect, canCreate }: VenueSearchProps) {
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Create form state
  const [newName, setNewName] = useState("");
  const [newAddress, setNewAddress] = useState("");
  const [newCity, setNewCity] = useState<string>("NYC");
  const [newVenueType, setNewVenueType] = useState("theater");
  const [newWebsite, setNewWebsite] = useState("");
  const [createError, setCreateError] = useState<string | null>(null);

  useEffect(() => {
    timerRef.current = setTimeout(() => {
      setDebouncedQuery(query);
    }, 200);
    return () => clearTimeout(timerRef.current);
  }, [query]);

  const [{ data, fetching }] = useQuery({
    query: SEARCH_VENUES_QUERY,
    variables: { search: debouncedQuery, first: 8 },
    pause: debouncedQuery.length < 2,
  });

  const results: VenueResult[] =
    data?.venueList?.edges?.map((e: any) => e.node) ?? [];

  const [{ fetching: creating }, createVenue] = useMutation(VENUE_FIND_OR_CREATE_MUTATION);

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
    (venue: VenueResult) => {
      setQuery(venue.name);
      setIsOpen(false);
      setShowCreateForm(false);
      onSelect(venue);
    },
    [onSelect]
  );

  const handleStartCreate = useCallback(() => {
    setNewName(query);
    setShowCreateForm(true);
    setIsOpen(false);
    setCreateError(null);
  }, [query]);

  const selectedCity = CITY_OPTIONS.find((c) => c.value === newCity);

  async function handleCreateSubmit(e: React.FormEvent) {
    e.preventDefault();
    setCreateError(null);

    if (!newName.trim() || !newAddress.trim()) {
      setCreateError("Name and address are required.");
      return;
    }

    const result = await createVenue({
      input: {
        name: newName.trim(),
        address: newAddress.trim(),
        city: newCity,
        state: selectedCity?.state || "NY",
        latitude: 0,
        longitude: 0,
        venueType: newVenueType,
        website: newWebsite.trim() || undefined,
      },
    });

    if (result.data?.venueFindOrCreate?.error) {
      setCreateError(result.data.venueFindOrCreate.error);
      return;
    }

    if (result.error) {
      setCreateError("Something went wrong. Try again.");
      return;
    }

    const venue = result.data?.venueFindOrCreate?.venue;
    if (venue) {
      handleSelect(venue);
    }
  }

  if (showCreateForm) {
    return (
      <div className="space-y-4">
        <div className="flex items-baseline justify-between">
          <span className="text-xs uppercase tracking-widest text-curtn-muted">
            New Venue
          </span>
          <button
            type="button"
            onClick={() => setShowCreateForm(false)}
            className="text-xs text-curtn-coral hover:text-curtn-red transition-colors cursor-pointer"
          >
            Back to search
          </button>
        </div>

        <div className="space-y-3">
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Venue name"
            className="w-full bg-transparent border-b border-curtn-dark text-curtn-cream placeholder:text-curtn-dark py-2 text-sm outline-none focus:border-curtn-coral transition-colors duration-200"
          />
          <input
            type="text"
            value={newAddress}
            onChange={(e) => setNewAddress(e.target.value)}
            placeholder="Street address"
            className="w-full bg-transparent border-b border-curtn-dark text-curtn-cream placeholder:text-curtn-dark py-2 text-sm outline-none focus:border-curtn-coral transition-colors duration-200"
          />
          <select
            value={newCity}
            onChange={(e) => setNewCity(e.target.value)}
            className="w-full bg-transparent border-b border-curtn-dark text-curtn-cream py-2 text-sm outline-none focus:border-curtn-coral transition-colors duration-200 cursor-pointer"
          >
            {CITY_OPTIONS.map((c) => (
              <option key={c.value} value={c.value} className="bg-curtn-surface">
                {c.label}
              </option>
            ))}
          </select>
          <select
            value={newVenueType}
            onChange={(e) => setNewVenueType(e.target.value)}
            className="w-full bg-transparent border-b border-curtn-dark text-curtn-cream py-2 text-sm outline-none focus:border-curtn-coral transition-colors duration-200 cursor-pointer"
          >
            <option value="theater" className="bg-curtn-surface">Theater</option>
            <option value="concert-hall" className="bg-curtn-surface">Concert Hall</option>
            <option value="dance-studio" className="bg-curtn-surface">Dance Studio</option>
            <option value="comedy-club" className="bg-curtn-surface">Comedy Club</option>
            <option value="multi-purpose" className="bg-curtn-surface">Multi-purpose</option>
            <option value="outdoor" className="bg-curtn-surface">Outdoor</option>
            <option value="other" className="bg-curtn-surface">Other</option>
          </select>
          <input
            type="text"
            value={newWebsite}
            onChange={(e) => setNewWebsite(e.target.value)}
            placeholder="Website (optional)"
            className="w-full bg-transparent border-b border-curtn-dark text-curtn-cream placeholder:text-curtn-dark py-2 text-sm outline-none focus:border-curtn-coral transition-colors duration-200"
          />
        </div>

        {createError && (
          <p className="text-sm text-curtn-red">{createError}</p>
        )}

        <button
          type="button"
          onClick={handleCreateSubmit}
          disabled={creating}
          className="w-full py-2 text-sm font-medium text-curtn-deep bg-curtn-coral hover:bg-curtn-red transition-colors disabled:opacity-50 cursor-pointer"
        >
          {creating ? "Creating..." : "Add Venue"}
        </button>
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
            <div className="px-4 py-3 text-sm text-curtn-muted">Searching...</div>
          )}
          {!fetching && results.length === 0 && (
            <div className="px-4 py-3 text-sm text-curtn-muted">
              {canCreate ? (
                <>
                  No venues found.{" "}
                  <button
                    type="button"
                    onClick={handleStartCreate}
                    className="text-curtn-coral hover:text-curtn-red transition-colors cursor-pointer underline"
                  >
                    Add it
                  </button>
                </>
              ) : (
                "No venues found. Log 3 shows to unlock adding new ones."
              )}
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
                <span className="text-curtn-cream font-medium">{venue.name}</span>
                <span className="text-curtn-muted ml-2 text-xs">{venue.city}</span>
              </button>
            ))}
        </div>
      )}
    </div>
  );
}
