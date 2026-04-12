"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useQuery, useMutation } from "urql";
import { useRouter } from "next/navigation";
import {
  parseShowInput,
  formatDateForInput,
  formatDateHuman,
} from "@/lib/parseShowInput";
import {
  VENUES_NEAR_QUERY,
  SEARCH_SHOWS_QUICK,
  SEARCH_VENUES_QUICK,
} from "@/lib/graphql/smartLog";
import { SHOW_FIND_OR_CREATE_MUTATION } from "@/lib/graphql/shows";
import { RUN_FIND_OR_CREATE_MUTATION } from "@/lib/graphql/runs";
import { PERFORMANCE_CREATE_MUTATION } from "@/lib/graphql/performances";
import { VENUE_FIND_OR_CREATE_MUTATION } from "@/lib/graphql/venues";
import { REVIEW_CREATE_MUTATION } from "@/lib/graphql/reviews";
import { SEEN_CREATE_MUTATION } from "@/lib/graphql/seen";
import { saveRecentLog } from "@/lib/recentLog";
import { StarRating } from "@/components/StarRating";

// ─── Types ──────────────────────────────────────────────────────────────────

interface ParsedState {
  showName: string;
  venueName: string | null;
  date: Date | null;
  time: string | null;
}

interface ResolvedShow {
  id: string;
  title: string;
  isNew: boolean;
}

interface ResolvedVenue {
  id: string;
  name: string;
  city: string;
  isNew: boolean;
}

// ─── Nearby Venues (Model C) ───────────────────────────────────────────────

function useNearbyVenues() {
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(
    null
  );
  const [denied, setDenied] = useState(false);

  useEffect(() => {
    if (!navigator.geolocation) {
      setDenied(true);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => setDenied(true),
      { enableHighAccuracy: false, timeout: 5000 }
    );
  }, []);

  const [{ data }] = useQuery({
    query: VENUES_NEAR_QUERY,
    variables: {
      latitude: coords?.lat ?? 0,
      longitude: coords?.lng ?? 0,
      maxDistance: 2000, // ~1.2 miles
      first: 5,
    },
    pause: !coords,
  });

  const venues = useMemo(
    () => (data?.venuesNear?.edges?.map((e: any) => e.node) ?? []).filter(Boolean),
    [data]
  );

  return { venues, loading: !coords && !denied, denied };
}

// ─── Debounced search hooks ─────────────────────────────────────────────────

function useDebouncedValue(value: string, delay = 250) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

// ─── Main Component ─────────────────────────────────────────────────────────

export function SmartLogForm() {
  const router = useRouter();

  // Raw input
  const [rawInput, setRawInput] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  // Parsed state (from NLP)
  const [parsed, setParsed] = useState<ParsedState>({
    showName: "",
    venueName: null,
    date: null,
    time: null,
  });

  // Resolved entities (matched to DB or marked as new)
  const [resolvedShow, setResolvedShow] = useState<ResolvedShow | null>(null);
  const [resolvedVenue, setResolvedVenue] = useState<ResolvedVenue | null>(
    null
  );

  // Manual overrides (Model A fallback)
  const [editingField, setEditingField] = useState<
    "show" | "venue" | "date" | "time" | null
  >(null);
  const [manualDate, setManualDate] = useState("");
  const [manualTime, setManualTime] = useState("");

  // Rating and review
  const [rating, setRating] = useState(0);
  const [reviewText, setReviewText] = useState("");
  const [showReviewField, setShowReviewField] = useState(false);

  // Submission state
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Nearby venues (Model C)
  const { venues: nearbyVenues } = useNearbyVenues();

  // Mutations
  const [, showFindOrCreate] = useMutation(SHOW_FIND_OR_CREATE_MUTATION);
  const [, runFindOrCreate] = useMutation(RUN_FIND_OR_CREATE_MUTATION);
  const [, performanceCreate] = useMutation(PERFORMANCE_CREATE_MUTATION);
  const [, venueFindOrCreate] = useMutation(VENUE_FIND_OR_CREATE_MUTATION);
  const [, createReview] = useMutation(REVIEW_CREATE_MUTATION);
  const [, createSeen] = useMutation(SEEN_CREATE_MUTATION);

  // ── Parse input on change ───────────────────────────────────────────────

  useEffect(() => {
    if (!rawInput.trim()) {
      setParsed({ showName: "", venueName: null, date: null, time: null });
      setResolvedShow(null);
      setResolvedVenue(null);
      return;
    }
    const result = parseShowInput(rawInput);
    setParsed({
      showName: result.showName,
      venueName: result.venueName,
      date: result.date,
      time: result.time,
    });
  }, [rawInput]);

  // ── Search for show matches ─────────────────────────────────────────────

  const debouncedShowName = useDebouncedValue(parsed.showName);
  const [{ data: showSearchData }] = useQuery({
    query: SEARCH_SHOWS_QUICK,
    variables: { query: debouncedShowName, first: 3 },
    pause: debouncedShowName.length < 2,
  });

  const showMatches = useMemo(
    () =>
      (showSearchData?.searchShows?.edges?.map((e: any) => e.node) ?? []).filter(Boolean),
    [showSearchData]
  );

  // Auto-resolve show if there's an exact (case-insensitive) match
  useEffect(() => {
    if (editingField === "show") return; // Don't auto-resolve while editing
    const exact = showMatches.find(
      (s: any) =>
        s.title.toLowerCase() === parsed.showName.toLowerCase()
    );
    if (exact) {
      setResolvedShow({ id: exact.id, title: exact.title, isNew: false });
    } else if (parsed.showName.length >= 2) {
      setResolvedShow({
        id: "",
        title: parsed.showName,
        isNew: true,
      });
    } else {
      setResolvedShow(null);
    }
  }, [showMatches, parsed.showName, editingField]);

  // ── Search for venue matches ────────────────────────────────────────────

  const debouncedVenueName = useDebouncedValue(parsed.venueName || "");
  const [{ data: venueSearchData }] = useQuery({
    query: SEARCH_VENUES_QUICK,
    variables: { search: debouncedVenueName, first: 3 },
    pause: debouncedVenueName.length < 2,
  });

  const venueMatches = useMemo(
    () =>
      (venueSearchData?.venueList?.edges?.map((e: any) => e.node) ?? []).filter(Boolean),
    [venueSearchData]
  );

  // Auto-resolve venue
  useEffect(() => {
    if (editingField === "venue") return;
    if (!parsed.venueName) {
      setResolvedVenue(null);
      return;
    }
    const exact = venueMatches.find(
      (v: any) =>
        v.name.toLowerCase() === parsed.venueName?.toLowerCase()
    );
    if (exact) {
      setResolvedVenue({
        id: exact.id,
        name: exact.name,
        city: exact.city,
        isNew: false,
      });
    } else if (parsed.venueName.length >= 2) {
      setResolvedVenue({
        id: "",
        name: parsed.venueName,
        city: "NYC",
        isNew: true,
      });
    }
  }, [venueMatches, parsed.venueName, editingField]);

  // ── Effective date/time (manual overrides > parsed) ─────────────────────

  const effectiveDate = manualDate
    ? new Date(manualDate + "T12:00:00")
    : parsed.date;
  const effectiveTime = manualTime || parsed.time;
  const effectiveDateStr = effectiveDate
    ? formatDateForInput(effectiveDate)
    : formatDateForInput(new Date()); // default to today

  // ── Handle suggestion tap (Model C) ─────────────────────────────────────

  const handleSuggestionTap = useCallback(
    (venue: any) => {
      setResolvedVenue({
        id: venue.id,
        name: venue.name,
        city: venue.city,
        isNew: false,
      });
      // Focus the input for show name
      inputRef.current?.focus();
    },
    []
  );

  // ── Handle show match selection ─────────────────────────────────────────

  const handleShowMatchSelect = useCallback((show: any) => {
    setResolvedShow({ id: show.id, title: show.title, isNew: false });
    // If the show has a known venue, auto-fill it
    const firstRun = show.runs?.edges?.[0]?.node;
    if (firstRun?.venues?.[0] && !resolvedVenue) {
      const v = firstRun.venues[0];
      setResolvedVenue({ id: v.id, name: v.name, city: v.city, isNew: false });
    }
    setEditingField(null);
  }, [resolvedVenue]);

  // ── Handle venue match selection ────────────────────────────────────────

  const handleVenueMatchSelect = useCallback((venue: any) => {
    setResolvedVenue({
      id: venue.id,
      name: venue.name,
      city: venue.city,
      isNew: false,
    });
    setEditingField(null);
  }, []);

  // ── Submit ──────────────────────────────────────────────────────────────

  const hasDate = !!(parsed.date || manualDate);
  const isFullReview = hasDate && rating > 0;
  const canSubmit =
    (resolvedShow?.title || parsed.showName) && !submitting;

  const handleSubmit = useCallback(async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);

    try {
      const showTitle = resolvedShow?.title || parsed.showName;

      // Step 1: Find or create show
      const showResult = await showFindOrCreate({
        input: { title: showTitle },
      });
      if (showResult.data?.showFindOrCreate?.error) {
        setError(showResult.data.showFindOrCreate.error);
        return;
      }
      const showId = showResult.data?.showFindOrCreate?.show?.id;
      if (!showId) {
        setError("Failed to create show.");
        return;
      }

      // Step 2: Find or create venue (if provided)
      let venueId: string | null = null;
      let venueName = resolvedVenue?.name || parsed.venueName;

      if (venueName) {
        if (resolvedVenue && !resolvedVenue.isNew) {
          venueId = resolvedVenue.id;
        } else {
          const venueResult = await venueFindOrCreate({
            input: {
              name: venueName,
              address: venueName, // Use name as placeholder address
              city: resolvedVenue?.city || "NYC",
              state: "NY",
              latitude: 40.7128,
              longitude: -74.006,
            },
          });
          if (venueResult.data?.venueFindOrCreate?.venue) {
            venueId = venueResult.data.venueFindOrCreate.venue.id;
            venueName = venueResult.data.venueFindOrCreate.venue.name;
          }
        }
      }

      // Step 3: Find or create run
      const runInput: any = {
        showId,
        ...(venueId ? { venueIds: [venueId] } : {}),
        ...(hasDate ? { startDate: effectiveDateStr } : {}),
      };
      const runResult = await runFindOrCreate({ input: runInput });
      if (runResult.data?.runFindOrCreate?.error) {
        setError(runResult.data.runFindOrCreate.error);
        return;
      }
      const runId = runResult.data?.runFindOrCreate?.run?.id;
      if (!runId) {
        setError("Failed to create run.");
        return;
      }

      // Branch: full review (has date + rating) vs. seen-only
      if (isFullReview) {
        // Step 4: Create performance
        const perfResult = await performanceCreate({
          input: {
            runId,
            date: effectiveDateStr,
            time: effectiveTime || "",
            ...(venueId ? { venueId } : {}),
          },
        });
        if (perfResult.data?.performanceCreate?.error) {
          setError(perfResult.data.performanceCreate.error);
          return;
        }
        const performanceId =
          perfResult.data?.performanceCreate?.performance?.id;
        if (!performanceId) {
          setError("Failed to create performance.");
          return;
        }

        // Step 5: Create review (also promotes any existing Seen)
        const reviewResult = await createReview({
          input: {
            performance: performanceId,
            run: runId,
            venue: venueName || "Unknown",
            rating,
            attendedAt: effectiveDateStr,
            ...(reviewText.trim() ? { text: reviewText.trim() } : {}),
          },
        });
        if (reviewResult.data?.reviewCreate?.error) {
          setError(reviewResult.data.reviewCreate.error);
          return;
        }

        saveRecentLog({
          runId,
          showTitle,
          venueName: venueName || null,
          rating,
        });
      } else {
        // Lightweight seen — no date required
        const seenResult = await createSeen({ input: { runId } });
        if (seenResult.data?.seenCreate?.error) {
          setError(seenResult.data.seenCreate.error);
          return;
        }

        saveRecentLog({
          runId,
          showTitle,
          venueName: venueName || null,
          rating: rating || 0,
        });
      }

      // Redirect to the run page
      router.push(`/runs/${encodeURIComponent(runId)}?logged=1`);
    } catch {
      setError("Something went wrong. Try again.");
    } finally {
      setSubmitting(false);
    }
  }, [
    canSubmit,
    isFullReview,
    hasDate,
    resolvedShow,
    resolvedVenue,
    parsed,
    effectiveDateStr,
    effectiveTime,
    rating,
    reviewText,
    showFindOrCreate,
    venueFindOrCreate,
    runFindOrCreate,
    performanceCreate,
    createReview,
    createSeen,
    router,
  ]);

  // ── Has any content been entered ────────────────────────────────────────

  const hasInput = rawInput.length > 0 || resolvedVenue !== null;
  const hasParsedAnything =
    parsed.showName.length > 0 ||
    parsed.venueName ||
    parsed.date ||
    resolvedVenue;

  // ── Render ──────────────────────────────────────────────────────────────

  return (
    <div className="max-w-lg mx-auto space-y-5 pb-24">
      {/* ── Model C: Nearby venue suggestions ─────────────────────────── */}
      {!hasInput && nearbyVenues.length > 0 && (
        <div>
          <p className="text-xs uppercase tracking-widest text-curtn-muted mb-3">
            Near you now
          </p>
          <div className="flex gap-2 overflow-x-auto pb-2">
            {nearbyVenues.map((venue: any) => (
              <button
                key={venue.id}
                type="button"
                onClick={() => handleSuggestionTap(venue)}
                className="shrink-0 border border-curtn-dark/50 px-3 py-2 text-sm text-curtn-cream hover:border-curtn-coral/50 hover:text-curtn-coral transition-colors cursor-pointer"
              >
                {venue.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Model B: Smart input ──────────────────────────────────────── */}
      <div>
        <label
          htmlFor="smart-log-input"
          className="text-xs uppercase tracking-widest text-curtn-muted mb-2 block"
        >
          What did you see?
        </label>
        <input
          ref={inputRef}
          id="smart-log-input"
          type="text"
          value={rawInput}
          onChange={(e) => setRawInput(e.target.value)}
          placeholder={
            resolvedVenue
              ? `Show name at ${resolvedVenue.name}...`
              : "Show, venue, date..."
          }
          className="w-full bg-transparent border-b-2 border-curtn-dark text-curtn-cream placeholder:text-curtn-dark/60 py-3 text-base sm:text-lg outline-none focus:border-curtn-coral transition-colors duration-200"
          autoComplete="off"
          autoFocus
        />
      </div>

      {/* ── Show search matches (dropdown) ────────────────────────────── */}
      {parsed.showName.length >= 2 &&
        showMatches.length > 0 &&
        !resolvedShow?.id && (
          <div className="border border-curtn-dark/50 bg-curtn-surface divide-y divide-curtn-dark/30">
            {showMatches.map((show: any) => (
              <button
                key={show.id}
                type="button"
                onClick={() => handleShowMatchSelect(show)}
                className="w-full text-left px-4 py-3 text-sm hover:bg-curtn-dark/30 transition-colors cursor-pointer"
              >
                <span className="text-curtn-cream font-medium">
                  {show.title}
                </span>
                {show.runs?.edges?.[0]?.node?.venues?.[0]?.name && (
                  <span className="text-curtn-muted ml-2 text-xs">
                    at {show.runs.edges[0].node.venues[0].name}
                  </span>
                )}
              </button>
            ))}
          </div>
        )}

      {/* ── Model A: Preview card with tappable chunks ────────────────── */}
      {hasParsedAnything && (
        <div className="border border-curtn-dark/50 bg-curtn-surface/50 px-4 py-3 space-y-2">
          {/* Show */}
          <div
            className="cursor-pointer group"
            onClick={() => setEditingField(editingField === "show" ? null : "show")}
          >
            <span className="text-xs uppercase tracking-widest text-curtn-muted">
              Show
            </span>
            {editingField === "show" ? (
              <div className="mt-1 space-y-2">
                <input
                  type="text"
                  value={parsed.showName}
                  onChange={(e) => {
                    setRawInput(e.target.value + (parsed.venueName ? ` at ${parsed.venueName}` : ""));
                  }}
                  className="w-full bg-transparent border-b border-curtn-coral text-curtn-cream py-1 text-sm outline-none"
                  autoFocus
                />
                {showMatches.length > 0 && (
                  <div className="space-y-1">
                    {showMatches.map((s: any) => (
                      <button
                        key={s.id}
                        type="button"
                        onClick={(e) => { e.stopPropagation(); handleShowMatchSelect(s); }}
                        className="block w-full text-left px-2 py-1.5 text-xs text-curtn-cream hover:bg-curtn-dark/30 transition-colors cursor-pointer"
                      >
                        {s.title}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <p className="text-sm text-curtn-cream mt-0.5 group-hover:text-curtn-coral transition-colors">
                {resolvedShow?.title || parsed.showName || "—"}
                {resolvedShow && !resolvedShow.isNew && (
                  <span className="text-curtn-muted text-xs ml-2">matched</span>
                )}
                {resolvedShow?.isNew && (
                  <span className="text-curtn-coral/60 text-xs ml-2">new</span>
                )}
              </p>
            )}
          </div>

          {/* Venue */}
          <div
            className="cursor-pointer group"
            onClick={() => setEditingField(editingField === "venue" ? null : "venue")}
          >
            <span className="text-xs uppercase tracking-widest text-curtn-muted">
              Venue
            </span>
            {editingField === "venue" ? (
              <div className="mt-1 space-y-2">
                <input
                  type="text"
                  defaultValue={resolvedVenue?.name || parsed.venueName || ""}
                  onChange={(e) => {
                    const val = e.target.value;
                    setParsed((p) => ({ ...p, venueName: val || null }));
                  }}
                  className="w-full bg-transparent border-b border-curtn-coral text-curtn-cream py-1 text-sm outline-none"
                  autoFocus
                  placeholder="Venue name..."
                />
                {venueMatches.length > 0 && (
                  <div className="space-y-1">
                    {venueMatches.map((v: any) => (
                      <button
                        key={v.id}
                        type="button"
                        onClick={(e) => { e.stopPropagation(); handleVenueMatchSelect(v); }}
                        className="block w-full text-left px-2 py-1.5 text-xs text-curtn-cream hover:bg-curtn-dark/30 transition-colors cursor-pointer"
                      >
                        {v.name}
                        <span className="text-curtn-muted ml-1">{v.city}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <p className="text-sm text-curtn-cream mt-0.5 group-hover:text-curtn-coral transition-colors">
                {resolvedVenue?.name || parsed.venueName || (
                  <span className="text-curtn-dark">Tap to add venue</span>
                )}
                {resolvedVenue && !resolvedVenue.isNew && (
                  <span className="text-curtn-muted text-xs ml-2">matched</span>
                )}
                {resolvedVenue?.isNew && (
                  <span className="text-curtn-coral/60 text-xs ml-2">new</span>
                )}
              </p>
            )}
          </div>

          {/* Date + Time row */}
          <div className="grid grid-cols-2 gap-3">
            {/* Date */}
            <div
              className="cursor-pointer group"
              onClick={() => setEditingField(editingField === "date" ? null : "date")}
            >
              <span className="text-xs uppercase tracking-widest text-curtn-muted">
                Date
              </span>
              {editingField === "date" ? (
                <input
                  type="date"
                  value={manualDate || (effectiveDate ? formatDateForInput(effectiveDate) : "")}
                  onChange={(e) => {
                    setManualDate(e.target.value);
                    setEditingField(null);
                  }}
                  className="mt-0.5 w-full bg-transparent border-b border-curtn-coral text-curtn-cream py-1 text-sm outline-none [color-scheme:dark]"
                  autoFocus
                />
              ) : (
                <p className="text-sm text-curtn-cream mt-0.5 group-hover:text-curtn-coral transition-colors">
                  {effectiveDate
                    ? formatDateHuman(effectiveDate)
                    : formatDateHuman(new Date())}{" "}
                  {!parsed.date && !manualDate && (
                    <span className="text-curtn-muted text-xs">today</span>
                  )}
                </p>
              )}
            </div>

            {/* Time */}
            <div
              className="cursor-pointer group"
              onClick={() => setEditingField(editingField === "time" ? null : "time")}
            >
              <span className="text-xs uppercase tracking-widest text-curtn-muted">
                Time
              </span>
              {editingField === "time" ? (
                <input
                  type="text"
                  defaultValue={effectiveTime || ""}
                  placeholder="e.g. 7:30 PM"
                  onChange={(e) => setManualTime(e.target.value)}
                  onBlur={() => setEditingField(null)}
                  className="mt-0.5 w-full bg-transparent border-b border-curtn-coral text-curtn-cream py-1 text-sm outline-none"
                  autoFocus
                />
              ) : (
                <p className="text-sm text-curtn-cream mt-0.5 group-hover:text-curtn-coral transition-colors">
                  {effectiveTime || (
                    <span className="text-curtn-dark">Tap to add</span>
                  )}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Rating ────────────────────────────────────────────────────── */}
      {hasParsedAnything && (
        <div>
          <span className="text-xs uppercase tracking-widest text-curtn-muted block mb-2">
            Rating
          </span>
          <StarRating value={rating} onChange={setRating} size={32} />
        </div>
      )}

      {/* ── Review (optional, expandable) ─────────────────────────────── */}
      {hasParsedAnything && rating > 0 && (
        <div>
          {!showReviewField ? (
            <button
              type="button"
              onClick={() => setShowReviewField(true)}
              className="text-xs text-curtn-muted hover:text-curtn-coral transition-colors cursor-pointer"
            >
              + Add a review
            </button>
          ) : (
            <div>
              <label
                htmlFor="review-text"
                className="text-xs uppercase tracking-widest text-curtn-muted mb-2 block"
              >
                Review
              </label>
              <textarea
                id="review-text"
                value={reviewText}
                onChange={(e) => setReviewText(e.target.value)}
                placeholder="What moved you?"
                rows={3}
                className="w-full bg-transparent border border-curtn-dark/50 text-curtn-cream placeholder:text-curtn-dark p-3 text-sm outline-none focus:border-curtn-coral transition-colors duration-200 resize-none"
                autoFocus
              />
            </div>
          )}
        </div>
      )}

      {/* ── Error ─────────────────────────────────────────────────────── */}
      {error && (
        <div className="border border-curtn-red/30 bg-curtn-red/10 px-4 py-3 text-sm text-curtn-red">
          {error}
        </div>
      )}

      {/* ── Submit ────────────────────────────────────────────────────── */}
      {hasParsedAnything && (
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!canSubmit}
          className="w-full dog-ear dog-ear-dark bg-curtn-coral py-3 text-sm font-display font-bold uppercase tracking-wide text-curtn-deep hover:bg-curtn-red transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {submitting ? "Logging..." : "Log This Show"}
        </button>
      )}

    </div>
  );
}
