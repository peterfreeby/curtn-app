"use client";

import { useState, useCallback } from "react";
import { useMutation } from "urql";
import { useRouter } from "next/navigation";
import { ShowSearch } from "@/components/log/ShowSearch";
import { CompanySearchInput } from "./CompanySearchInput";
import { VenueSearchInput } from "./VenueSearchInput";
import { SHOW_FIND_OR_CREATE_MUTATION } from "@/lib/graphql/shows";
import { RUN_FIND_OR_CREATE_MUTATION } from "@/lib/graphql/runs";
import { PERFORMANCE_CREATE_MUTATION } from "@/lib/graphql/performances";

const PERFORMANCE_TYPES = [
  "theater",
  "musical",
  "dance",
  "comedy",
  "improv",
  "spoken-word",
  "cabaret",
  "experimental",
  "immersive",
  "drag",
  "burlesque",
  "happening",
  "other",
] as const;

interface ShowSelection {
  id: string;
  title: string;
  isNew: boolean;
}

interface CompanySelection {
  id: string;
  name: string;
}

interface VenueSelection {
  id: string;
  name: string;
  city: string;
}

export function AddPerformanceForm() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Show state
  const [selectedShow, setSelectedShow] = useState<ShowSelection | null>(null);
  const [showCreating, setShowCreating] = useState(false);
  const [newShowTitle, setNewShowTitle] = useState("");
  const [newShowDescription, setNewShowDescription] = useState("");
  const [newShowTypes, setNewShowTypes] = useState<string[]>([]);
  const [newShowDuration, setNewShowDuration] = useState("");
  const [showUrl, setShowUrl] = useState("");

  // Venue state
  const [selectedVenue, setSelectedVenue] = useState<VenueSelection | null>(
    null
  );

  // Details state
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [ticketUrl, setTicketUrl] = useState("");

  // Company state (optional)
  const [selectedCompany, setSelectedCompany] =
    useState<CompanySelection | null>(null);

  // Mutations
  const [, showFindOrCreate] = useMutation(SHOW_FIND_OR_CREATE_MUTATION);
  const [, runFindOrCreate] = useMutation(RUN_FIND_OR_CREATE_MUTATION);
  const [, performanceCreate] = useMutation(PERFORMANCE_CREATE_MUTATION);

  const handleShowSelect = useCallback(
    (show: { id: string; title: string }) => {
      setSelectedShow({ id: show.id, title: show.title, isNew: false });
      setShowCreating(false);
    },
    []
  );

  const canSubmit =
    (selectedShow || (showCreating && newShowTitle.trim())) &&
    selectedVenue &&
    date &&
    time &&
    !submitting;

  const toggleShowType = (type: string) => {
    setNewShowTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
    );
  };

  const handleSubmit = useCallback(async () => {
    const hasShow = selectedShow || (showCreating && newShowTitle.trim());
    if (!hasShow || !selectedVenue || !date || !time) return;

    setSubmitting(true);
    setError(null);

    try {
      // Step 1: Find or create show
      let showId: string;
      if (selectedShow && !selectedShow.isNew) {
        showId = selectedShow.id;
      } else {
        const title = selectedShow?.isNew
          ? selectedShow.title
          : newShowTitle.trim();
        const showResult = await showFindOrCreate({
          input: {
            title,
            description: newShowDescription || undefined,
            performanceTypes:
              newShowTypes.length > 0 ? newShowTypes : undefined,
            duration: newShowDuration ? parseInt(newShowDuration) : undefined,
            url: showUrl || undefined,
          },
        });
        if (showResult.data?.showFindOrCreate?.error) {
          setError(showResult.data.showFindOrCreate.error);
          setSubmitting(false);
          return;
        }
        showId = showResult.data?.showFindOrCreate?.show?.id;
        if (!showId) {
          setError("Failed to create show");
          setSubmitting(false);
          return;
        }
      }

      // Step 2: Find or create run (company optional)
      const runInput: any = {
        showId,
        venueIds: [selectedVenue.id],
      };
      if (selectedCompany) {
        runInput.productionCompanyId = selectedCompany.id;
      }
      const runResult = await runFindOrCreate({ input: runInput });
      if (runResult.data?.runFindOrCreate?.error) {
        setError(runResult.data.runFindOrCreate.error);
        setSubmitting(false);
        return;
      }
      const runId = runResult.data?.runFindOrCreate?.run?.id;
      if (!runId) {
        setError("Failed to create run");
        setSubmitting(false);
        return;
      }

      // Step 3: Create performance
      const perfResult = await performanceCreate({
        input: {
          runId,
          date: new Date(date).toISOString(),
          time,
          venueId: selectedVenue.id,
          ticketUrl: ticketUrl || undefined,
          soldOut: false,
        },
      });
      if (perfResult.data?.performanceCreate?.error) {
        setError(perfResult.data.performanceCreate.error);
        setSubmitting(false);
        return;
      }

      // Redirect to run page — use global ID directly since the page expects it
      router.push(`/runs/${runId}`);
    } catch {
      setError("Something went wrong. Please try again.");
      setSubmitting(false);
    }
  }, [
    selectedShow,
    showCreating,
    newShowTitle,
    selectedVenue,
    selectedCompany,
    date,
    time,
    ticketUrl,
    showUrl,
    newShowDescription,
    newShowTypes,
    newShowDuration,
    showFindOrCreate,
    runFindOrCreate,
    performanceCreate,
    router,
  ]);

  return (
    <div className="max-w-lg mx-auto space-y-8">
      {error && (
        <div className="border border-curtn-red/30 bg-curtn-red/10 px-4 py-3 text-sm text-curtn-red">
          {error}
        </div>
      )}

      {/* Show */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-curtn-cream">Show</h2>
        {!showCreating ? (
          <>
            <ShowSearch onSelect={handleShowSelect} />
            {selectedShow && (
              <div className="flex items-center gap-2 text-sm text-curtn-cream">
                <span className="font-medium">{selectedShow.title}</span>
                <button
                  type="button"
                  onClick={() => setSelectedShow(null)}
                  className="text-xs text-curtn-muted hover:text-curtn-coral transition-colors"
                >
                  Clear
                </button>
              </div>
            )}
            <button
              type="button"
              onClick={() => setShowCreating(true)}
              className="text-xs text-curtn-coral hover:text-curtn-cream transition-colors"
            >
              Can&apos;t find it? Add a new show
            </button>
          </>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="text-xs uppercase tracking-widest text-curtn-muted mb-2 block">
                Title
              </label>
              <input
                type="text"
                value={newShowTitle}
                onChange={(e) => setNewShowTitle(e.target.value)}
                placeholder="Show title"
                className="w-full bg-transparent border-b border-curtn-dark text-curtn-cream placeholder:text-curtn-dark py-2 text-sm outline-none focus:border-curtn-coral transition-colors duration-200"
                autoFocus
              />
            </div>
            <div>
              <label className="text-xs uppercase tracking-widest text-curtn-muted mb-2 block">
                Type(s)
              </label>
              <div className="flex flex-wrap gap-2">
                {PERFORMANCE_TYPES.map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => toggleShowType(type)}
                    className={`chip-stamp capitalize cursor-pointer ${
                      newShowTypes.includes(type) ? "active" : ""
                    }`}
                  >
                    {type}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-xs uppercase tracking-widest text-curtn-muted mb-2 block">
                Description
              </label>
              <textarea
                value={newShowDescription}
                onChange={(e) => setNewShowDescription(e.target.value)}
                placeholder="Brief description (optional)"
                rows={3}
                className="w-full bg-transparent border border-curtn-dark text-curtn-cream placeholder:text-curtn-dark p-3 text-sm outline-none focus:border-curtn-coral transition-colors duration-200 resize-none"
              />
            </div>
            <div>
              <label className="text-xs uppercase tracking-widest text-curtn-muted mb-2 block">
                Duration (minutes)
              </label>
              <input
                type="number"
                value={newShowDuration}
                onChange={(e) => setNewShowDuration(e.target.value)}
                placeholder="e.g. 90"
                className="w-full bg-transparent border-b border-curtn-dark text-curtn-cream placeholder:text-curtn-dark py-2 text-sm outline-none focus:border-curtn-coral transition-colors duration-200"
              />
            </div>
            <div>
              <label className="text-xs uppercase tracking-widest text-curtn-muted mb-2 block">
                Show Link (optional)
              </label>
              <input
                type="url"
                value={showUrl}
                onChange={(e) => setShowUrl(e.target.value)}
                placeholder="https://..."
                className="w-full bg-transparent border-b border-curtn-dark text-curtn-cream placeholder:text-curtn-dark py-2 text-sm outline-none focus:border-curtn-coral transition-colors duration-200"
              />
            </div>
            <button
              type="button"
              onClick={() => {
                setShowCreating(false);
                setNewShowTitle("");
                setNewShowDescription("");
                setNewShowTypes([]);
                setNewShowDuration("");
                setShowUrl("");
              }}
              className="text-xs text-curtn-muted hover:text-curtn-cream transition-colors"
            >
              Back to search
            </button>
          </div>
        )}
      </section>

      {/* Venue */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-curtn-cream">Venue</h2>
        <VenueSearchInput onSelect={setSelectedVenue} />
        {selectedVenue && (
          <div className="flex items-center gap-2 text-sm text-curtn-cream">
            <span className="font-medium">
              {selectedVenue.name}
              {selectedVenue.city && (
                <span className="text-curtn-muted ml-1 text-xs">
                  {selectedVenue.city}
                </span>
              )}
            </span>
            <button
              type="button"
              onClick={() => setSelectedVenue(null)}
              className="text-xs text-curtn-muted hover:text-curtn-coral transition-colors"
            >
              Clear
            </button>
          </div>
        )}
      </section>

      {/* Date, Time, Tickets */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-curtn-cream">
          When &amp; Tickets
        </h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs uppercase tracking-widest text-curtn-muted mb-2 block">
              Date
            </label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full bg-transparent border-b border-curtn-dark text-curtn-cream py-2 text-sm outline-none focus:border-curtn-coral transition-colors duration-200 [color-scheme:dark]"
            />
          </div>
          <div>
            <label className="text-xs uppercase tracking-widest text-curtn-muted mb-2 block">
              Time
            </label>
            <input
              type="text"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              placeholder="e.g. 7:30 PM"
              className="w-full bg-transparent border-b border-curtn-dark text-curtn-cream placeholder:text-curtn-dark py-2 text-sm outline-none focus:border-curtn-coral transition-colors duration-200"
            />
          </div>
        </div>
        <div>
          <label className="text-xs uppercase tracking-widest text-curtn-muted mb-2 block">
            Ticket URL (optional)
          </label>
          <input
            type="url"
            value={ticketUrl}
            onChange={(e) => setTicketUrl(e.target.value)}
            placeholder="https://..."
            className="w-full bg-transparent border-b border-curtn-dark text-curtn-cream placeholder:text-curtn-dark py-2 text-sm outline-none focus:border-curtn-coral transition-colors duration-200"
          />
        </div>
      </section>

      {/* Production Company (optional) */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-curtn-cream">
          Production Company{" "}
          <span className="text-xs font-normal text-curtn-muted">
            optional
          </span>
        </h2>
        <CompanySearchInput onSelect={setSelectedCompany} />
        {selectedCompany && (
          <div className="flex items-center gap-2 text-sm text-curtn-cream">
            <span className="font-medium">{selectedCompany.name}</span>
            <button
              type="button"
              onClick={() => setSelectedCompany(null)}
              className="text-xs text-curtn-muted hover:text-curtn-coral transition-colors"
            >
              Clear
            </button>
          </div>
        )}
      </section>

      {/* Submit */}
      <button
        type="button"
        onClick={handleSubmit}
        disabled={!canSubmit}
        className="w-full dog-ear dog-ear-dark bg-curtn-coral py-3 text-sm font-display font-bold uppercase tracking-wide text-curtn-deep hover:bg-curtn-coral/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {submitting ? "Adding..." : "Add Performance"}
      </button>
    </div>
  );
}
