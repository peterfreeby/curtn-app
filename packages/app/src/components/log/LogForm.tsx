"use client";

import { useState, useMemo } from "react";
import { useQuery, useMutation } from "urql";
import { useRouter } from "next/navigation";
import { SINGLE_RUN_QUERY } from "@/lib/graphql/runs";
import { REVIEW_CREATE_MUTATION } from "@/lib/graphql/reviews";
import { StarRating } from "@/components/StarRating";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { ShowSearch } from "./ShowSearch";

interface LogFormProps {
  runId?: string | null;
}

export function LogForm({ runId }: LogFormProps) {
  const router = useRouter();

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

  // Resolve which run we're logging
  const activeRun = run
    ? { id: runId!, showTitle: run.show.title, companyName: run.productionCompany?.name }
    : selectedRun;

  // Selected performance (showing)
  const [selectedPerformanceId, setSelectedPerformanceId] = useState("");

  // Form state
  const [venue, setVenue] = useState("");
  const [attendedDate, setAttendedDate] = useState("");
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

  // Mutation
  const [{ fetching: submitting }, createReview] = useMutation(REVIEW_CREATE_MUTATION);

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
      // Try to match by date
      const match = showingOptions.find(
        (s: any) => new Date(s.date).toISOString().slice(0, 10) === attendedDate
      );
      if (match) performanceId = match.id;
    }

    if (!performanceId && showingOptions.length > 0) {
      // Use first showing as fallback
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

    // Navigate to the run detail page
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
            onSelect={(show) => {
              // If the show only has one run, auto-select it
              const runs = show.runs?.edges ?? [];
              if (runs.length === 1) {
                const r = runs[0].node;
                setSelectedRun({
                  id: r.id,
                  showTitle: show.title,
                  companyName: r.productionCompany?.name ?? "",
                });
              } else if (runs.length > 0) {
                // For now, pick the first run
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
              className="bg-transparent border border-curtn-dark/50 rounded-lg text-curtn-cream placeholder:text-curtn-dark p-3 text-sm outline-none focus:border-curtn-coral transition-colors duration-200 resize-none"
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
