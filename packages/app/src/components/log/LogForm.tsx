"use client";

import { useState, useMemo } from "react";
import { useQuery, useMutation } from "urql";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth/useAuth";
import { SINGLE_RUN_QUERY, RUN_FIND_OR_CREATE_MUTATION } from "@/lib/graphql/runs";
import { SHOW_FIND_OR_CREATE_MUTATION } from "@/lib/graphql/shows";
import { PERFORMANCE_CREATE_MUTATION } from "@/lib/graphql/performances";
import { REVIEW_CREATE_MUTATION } from "@/lib/graphql/reviews";
import { StarRating } from "@/components/StarRating";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { ShowSearch } from "./ShowSearch";
import { VenueSearch } from "./VenueSearch";

const PERFORMANCE_TYPE_OPTIONS = [
  "theater", "musical", "dance", "comedy", "improv", "spoken-word",
  "cabaret", "experimental", "immersive", "drag", "burlesque", "happening", "other",
] as const;

interface LogFormProps {
  runId?: string | null;
}

export function LogForm({ runId }: LogFormProps) {
  const router = useRouter();
  const { user } = useAuth();
  const canCreate = (user?.reviewCount ?? 0) >= 3;

  // If we have a run ID from URL, fetch its details
  const [{ data: runData, fetching: runFetching }] = useQuery({
    query: SINGLE_RUN_QUERY,
    variables: { id: runId! },
    pause: !runId,
  });

  const run = runData?.singleRun;

  // Selected run (from URL or from search)
  const [selectedRun, setSelectedRun] = useState<{
    id: string;
    showTitle: string;
    companyName: string;
  } | null>(null);

  // Creation mode state
  const [creationMode, setCreationMode] = useState(false);
  const [newShowTitle, setNewShowTitle] = useState("");
  const [newPerformanceTypes, setNewPerformanceTypes] = useState<string[]>([]);
  const [selectedVenue, setSelectedVenue] = useState<{ id: string; name: string; city: string } | null>(null);
  const [creationError, setCreationError] = useState<string | null>(null);
  const [isChaining, setIsChaining] = useState(false);

  // Resolve which run we're logging
  const activeRun = run
    ? { id: runId!, showTitle: run.show.title, companyName: run.productionCompany?.name }
    : selectedRun;

  // Selected performance (showing)
  const [selectedPerformanceId, setSelectedPerformanceId] = useState("");

  // Form state
  const [venue, setVenue] = useState("");
  const [attendedDate, setAttendedDate] = useState("");
  const [attendedTime, setAttendedTime] = useState("");
  const [rating, setRating] = useState(0);
  const [text, setText] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  // Venue options from run data
  const venueOptions = useMemo(() => {
    if (!run?.venues) return [];
    return run.venues.map((v: any) => ({ id: v.id, name: v.name }));
  }, [run]);

  // Showing options from run data
  const showingOptions = useMemo(() => {
    if (!run?.performances?.edges) return [];
    return run.performances.edges.map((e: any) => e.node);
  }, [run]);

  // Mutations
  const [{ fetching: submitting }, createReview] = useMutation(REVIEW_CREATE_MUTATION);
  const [, showFindOrCreate] = useMutation(SHOW_FIND_OR_CREATE_MUTATION);
  const [, runFindOrCreate] = useMutation(RUN_FIND_OR_CREATE_MUTATION);
  const [, performanceCreate] = useMutation(PERFORMANCE_CREATE_MUTATION);

  function togglePerformanceType(type: string) {
    setNewPerformanceTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
    );
  }

  async function handleCreationSubmit(e: React.FormEvent) {
    e.preventDefault();
    setCreationError(null);
    setFormError(null);

    if (!newShowTitle.trim()) {
      setCreationError("Enter a show title.");
      return;
    }
    if (!selectedVenue) {
      setCreationError("Select or create a venue.");
      return;
    }
    if (!attendedDate) {
      setCreationError("Select the date you attended.");
      return;
    }
    if (rating === 0) {
      setCreationError("Tap the stars to add a rating.");
      return;
    }

    setIsChaining(true);

    try {
      // Step 1: Find or create show
      const showResult = await showFindOrCreate({
        input: {
          title: newShowTitle.trim(),
          performanceTypes: newPerformanceTypes,
        },
      });

      if (showResult.data?.showFindOrCreate?.error) {
        setCreationError(showResult.data.showFindOrCreate.error);
        return;
      }
      if (showResult.error) {
        setCreationError("Failed to create show. Try again.");
        return;
      }

      const showId = showResult.data?.showFindOrCreate?.show?.id;
      if (!showId) {
        setCreationError("Failed to create show.");
        return;
      }

      // Step 2: Find or create run
      const runResult = await runFindOrCreate({
        input: {
          showId,
          venueIds: [selectedVenue.id],
          startDate: attendedDate,
        },
      });

      if (runResult.data?.runFindOrCreate?.error) {
        setCreationError(runResult.data.runFindOrCreate.error);
        return;
      }
      if (runResult.error) {
        setCreationError("Failed to create run. Try again.");
        return;
      }

      const createdRunId = runResult.data?.runFindOrCreate?.run?.id;
      if (!createdRunId) {
        setCreationError("Failed to create run.");
        return;
      }

      // Step 3: Create performance
      const perfResult = await performanceCreate({
        input: {
          runId: createdRunId,
          date: attendedDate,
          time: attendedTime || undefined,
          venueId: selectedVenue.id,
        },
      });

      if (perfResult.data?.performanceCreate?.error) {
        setCreationError(perfResult.data.performanceCreate.error);
        return;
      }
      if (perfResult.error) {
        setCreationError("Failed to create performance. Try again.");
        return;
      }

      const performanceId = perfResult.data?.performanceCreate?.performance?.id;
      if (!performanceId) {
        setCreationError("Failed to create performance.");
        return;
      }

      // Step 4: Create review
      const reviewResult = await createReview({
        input: {
          performance: performanceId,
          run: createdRunId,
          venue: selectedVenue.name,
          rating,
          attendedAt: attendedDate,
          ...(text.trim() ? { text: text.trim() } : {}),
        },
      });

      if (reviewResult.data?.reviewCreate?.error) {
        setCreationError(reviewResult.data.reviewCreate.error);
        return;
      }
      if (reviewResult.error) {
        setCreationError("Something went wrong. Try again.");
        return;
      }

      router.push(`/runs/${encodeURIComponent(createdRunId)}`);
    } finally {
      setIsChaining(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);

    if (!activeRun) {
      setFormError("Select a show to log.");
      return;
    }
    if (rating === 0) {
      setFormError("Tap the stars to add a rating.");
      return;
    }
    if (!attendedDate) {
      setFormError("Select the date you attended.");
      return;
    }

    // Find or use selected performance ID
    let performanceId = selectedPerformanceId;
    if (!performanceId && showingOptions.length > 0) {
      const match = showingOptions.find(
        (s: any) => new Date(s.date).toISOString().slice(0, 10) === attendedDate
      );
      if (match) performanceId = match.id;
    }

    if (!performanceId && showingOptions.length > 0) {
      performanceId = showingOptions[0].id;
    }

    if (!performanceId) {
      setFormError("No showing found for this run. Contact support.");
      return;
    }

    const input = {
      performance: performanceId,
      run: activeRun.id,
      venue: venue || "Unknown",
      rating,
      attendedAt: attendedDate,
      ...(text.trim() ? { text: text.trim() } : {}),
    };

    const result = await createReview({ input });

    if (result.data?.reviewCreate?.error) {
      setFormError(result.data.reviewCreate.error);
      return;
    }

    if (result.error) {
      setFormError("Something went wrong. Try again.");
      return;
    }

    router.push(`/runs/${encodeURIComponent(activeRun.id)}`);
  }

  // Loading state for pre-filled run
  if (runId && runFetching) {
    return (
      <Card className="animate-pulse space-y-4">
        <div className="h-6 w-2/3 rounded bg-curtn-dark/60" />
        <div className="h-4 w-1/3 rounded bg-curtn-dark/60" />
        <div className="h-10 w-full rounded bg-curtn-dark/60" />
      </Card>
    );
  }

  // Creation mode form
  if (creationMode) {
    return (
      <Card>
        <form onSubmit={handleCreationSubmit} className="space-y-6">
          {/* Show title */}
          <div>
            <div className="flex items-baseline justify-between">
              <span className="text-xs uppercase tracking-widest text-curtn-muted">
                New Show
              </span>
              <button
                type="button"
                onClick={() => setCreationMode(false)}
                className="text-xs text-curtn-coral hover:text-curtn-red transition-colors cursor-pointer"
              >
                Change
              </button>
            </div>
            <input
              type="text"
              value={newShowTitle}
              onChange={(e) => setNewShowTitle(e.target.value)}
              placeholder="Show title"
              className="w-full bg-transparent border-b border-curtn-dark text-curtn-cream placeholder:text-curtn-dark py-2 text-sm outline-none focus:border-curtn-coral transition-colors duration-200 mt-2"
            />
          </div>

          {/* Performance types */}
          <div className="flex flex-col gap-2">
            <span className="text-xs uppercase tracking-widest text-curtn-muted">
              Type
            </span>
            <div className="flex flex-wrap gap-2">
              {PERFORMANCE_TYPE_OPTIONS.map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => togglePerformanceType(type)}
                  className={`px-3 py-1 text-xs border transition-colors cursor-pointer ${
                    newPerformanceTypes.includes(type)
                      ? "border-curtn-coral text-curtn-coral"
                      : "border-curtn-dark/50 text-curtn-muted hover:border-curtn-dark"
                  }`}
                >
                  {type}
                </button>
              ))}
            </div>
          </div>

          {/* Venue search */}
          <VenueSearch
            onSelect={setSelectedVenue}
            canCreate={canCreate}
          />
          {selectedVenue && (
            <div className="flex items-baseline gap-3">
              <span className="text-sm text-curtn-cream">{selectedVenue.name}</span>
              <span className="text-xs text-curtn-muted">{selectedVenue.city}</span>
              <button
                type="button"
                onClick={() => setSelectedVenue(null)}
                className="text-xs text-curtn-coral hover:text-curtn-red transition-colors cursor-pointer"
              >
                Change
              </button>
            </div>
          )}

          {/* Date */}
          <div className="flex flex-col gap-2">
            <label
              htmlFor="creation-date"
              className="text-xs uppercase tracking-widest text-curtn-muted"
            >
              Date Attended
            </label>
            <input
              id="creation-date"
              type="date"
              value={attendedDate}
              onChange={(e) => setAttendedDate(e.target.value)}
              className="bg-transparent border-b border-curtn-dark text-curtn-cream py-2 text-sm outline-none focus:border-curtn-coral transition-colors duration-200"
            />
          </div>

          {/* Time */}
          <div className="flex flex-col gap-2">
            <label
              htmlFor="creation-time"
              className="text-xs uppercase tracking-widest text-curtn-muted"
            >
              Time <span className="normal-case tracking-normal">(optional)</span>
            </label>
            <input
              id="creation-time"
              type="time"
              value={attendedTime}
              onChange={(e) => setAttendedTime(e.target.value)}
              className="bg-transparent border-b border-curtn-dark text-curtn-cream py-2 text-sm outline-none focus:border-curtn-coral transition-colors duration-200"
            />
          </div>

          {/* Rating */}
          <div className="flex flex-col gap-2">
            <span className="text-xs uppercase tracking-widest text-curtn-muted">
              Rating
            </span>
            <StarRating value={rating} onChange={setRating} size={28} />
            {rating > 0 && (
              <span className="text-xs text-curtn-muted mt-1">{rating} / 5</span>
            )}
          </div>

          {/* Review text */}
          <div className="flex flex-col gap-2">
            <label
              htmlFor="creation-review-text"
              className="text-xs uppercase tracking-widest text-curtn-muted"
            >
              Review <span className="normal-case tracking-normal">(optional)</span>
            </label>
            <textarea
              id="creation-review-text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="What moved you?"
              rows={4}
              className="bg-transparent border border-curtn-dark/50 text-curtn-cream placeholder:text-curtn-dark p-3 text-sm outline-none focus:border-curtn-coral transition-colors duration-200 resize-none"
            />
          </div>

          {/* Error */}
          {creationError && (
            <p className="text-sm text-curtn-red">{creationError}</p>
          )}

          {/* Submit */}
          <Button type="submit" fullWidth disabled={isChaining}>
            {isChaining ? "Creating..." : "Log This Show"}
          </Button>
        </form>
      </Card>
    );
  }

  return (
    <Card>
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Show / Run selection */}
        {activeRun ? (
          <div>
            <span className="text-xs uppercase tracking-widest text-curtn-muted">
              Show
            </span>
            <div className="mt-2 flex items-baseline gap-3">
              <span className="text-lg font-semibold text-curtn-cream">
                {activeRun.showTitle}
              </span>
              {!runId && (
                <button
                  type="button"
                  onClick={() => setSelectedRun(null)}
                  className="text-xs text-curtn-coral hover:text-curtn-red transition-colors cursor-pointer"
                >
                  Change
                </button>
              )}
            </div>
            <p className="text-sm text-curtn-muted mt-0.5">by {activeRun.companyName}</p>
          </div>
        ) : (
          <ShowSearch
            canCreate={canCreate}
            onCreateNew={(searchQuery) => {
              setNewShowTitle(searchQuery);
              setCreationMode(true);
            }}
            onSelect={(show) => {
              const runs = show.runs?.edges ?? [];
              if (runs.length >= 1) {
                const r = runs[0].node;
                setSelectedRun({
                  id: r.id,
                  showTitle: show.title,
                  companyName: r.productionCompany?.name ?? "",
                });
              }
            }}
          />
        )}

        {/* Showing selector */}
        {activeRun && showingOptions.length > 0 && (
          <div className="flex flex-col gap-2">
            <label
              htmlFor="showing"
              className="text-xs uppercase tracking-widest text-curtn-muted"
            >
              Showing
            </label>
            <select
              id="showing"
              value={selectedPerformanceId}
              onChange={(e) => {
                setSelectedPerformanceId(e.target.value);
                const showing = showingOptions.find((s: any) => s.id === e.target.value);
                if (showing) {
                  setAttendedDate(new Date(showing.date).toISOString().slice(0, 10));
                  if (showing.venue?.name) setVenue(showing.venue.name);
                }
              }}
              className="bg-transparent border-b border-curtn-dark text-curtn-cream py-2 text-sm outline-none focus:border-curtn-coral transition-colors duration-200 cursor-pointer"
            >
              <option value="" className="bg-curtn-surface">
                Select a showing...
              </option>
              {showingOptions.map((s: any) => (
                <option key={s.id} value={s.id} className="bg-curtn-surface">
                  {new Date(s.date).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                  {" — "}
                  {s.time}
                  {s.venue?.name ? ` at ${s.venue.name}` : ""}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Venue selector */}
        {activeRun && (
          <div className="flex flex-col gap-2">
            <label
              htmlFor="venue"
              className="text-xs uppercase tracking-widest text-curtn-muted"
            >
              Venue
            </label>
            {venueOptions.length > 0 ? (
              <select
                id="venue"
                value={venue}
                onChange={(e) => setVenue(e.target.value)}
                className="bg-transparent border-b border-curtn-dark text-curtn-cream py-2 text-sm outline-none focus:border-curtn-coral transition-colors duration-200 cursor-pointer"
              >
                <option value="" className="bg-curtn-surface">
                  Select a venue...
                </option>
                {venueOptions.map((v: any) => (
                  <option key={v.id} value={v.name} className="bg-curtn-surface">
                    {v.name}
                  </option>
                ))}
              </select>
            ) : (
              <input
                id="venue"
                type="text"
                value={venue}
                onChange={(e) => setVenue(e.target.value)}
                placeholder="Where did you see it?"
                className="bg-transparent border-b border-curtn-dark text-curtn-cream placeholder:text-curtn-dark py-2 text-sm outline-none focus:border-curtn-coral transition-colors duration-200"
              />
            )}
          </div>
        )}

        {/* Date */}
        {activeRun && !selectedPerformanceId && (
          <div className="flex flex-col gap-2">
            <label
              htmlFor="attended-date"
              className="text-xs uppercase tracking-widest text-curtn-muted"
            >
              Date Attended
            </label>
            <input
              id="attended-date"
              type="date"
              value={attendedDate}
              onChange={(e) => setAttendedDate(e.target.value)}
              className="bg-transparent border-b border-curtn-dark text-curtn-cream py-2 text-sm outline-none focus:border-curtn-coral transition-colors duration-200"
            />
          </div>
        )}

        {/* Star rating */}
        {activeRun && (
          <div className="flex flex-col gap-2">
            <span className="text-xs uppercase tracking-widest text-curtn-muted">
              Rating
            </span>
            <StarRating value={rating} onChange={setRating} size={28} />
            {rating > 0 && (
              <span className="text-xs text-curtn-muted mt-1">{rating} / 5</span>
            )}
          </div>
        )}

        {/* Review text */}
        {activeRun && (
          <div className="flex flex-col gap-2">
            <label
              htmlFor="review-text"
              className="text-xs uppercase tracking-widest text-curtn-muted"
            >
              Review <span className="normal-case tracking-normal">(optional)</span>
            </label>
            <textarea
              id="review-text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="What moved you?"
              rows={4}
              className="bg-transparent border border-curtn-dark/50 text-curtn-cream placeholder:text-curtn-dark p-3 text-sm outline-none focus:border-curtn-coral transition-colors duration-200 resize-none"
            />
          </div>
        )}

        {/* Error */}
        {formError && (
          <p className="text-sm text-curtn-red">{formError}</p>
        )}

        {/* Submit */}
        {activeRun && (
          <Button type="submit" fullWidth disabled={submitting}>
            {submitting ? "Logging..." : "Log This Show"}
          </Button>
        )}
      </form>
    </Card>
  );
}
