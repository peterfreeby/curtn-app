"use client";

import { useState } from "react";
import { useMutation } from "urql";
import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
import { PERFORMANCE_CREATE_MUTATION } from "@/lib/graphql/performances";

const DAYS_OF_WEEK = [
  { key: 0, label: "Sun" },
  { key: 1, label: "Mon" },
  { key: 2, label: "Tue" },
  { key: 3, label: "Wed" },
  { key: 4, label: "Thu" },
  { key: 5, label: "Fri" },
  { key: 6, label: "Sat" },
];

interface PerformanceRow {
  date: string;
  time: string;
}

interface BatchPerformanceCreatorProps {
  runId: string; // Global ID
  venueId: string; // Global ID
  startDate?: string | null;
  endDate?: string | null;
  onCreated: () => void;
  onCancel: () => void;
}

// --- Cadence Generator ---

function generateCadencePerformances(
  startDate: string,
  endDate: string,
  selectedDays: Set<number>,
  showtimes: string[]
): PerformanceRow[] {
  const results: PerformanceRow[] = [];
  const start = new Date(startDate);
  const end = new Date(endDate);

  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    if (selectedDays.has(d.getDay())) {
      for (const time of showtimes) {
        results.push({
          date: d.toISOString().split("T")[0],
          time,
        });
      }
    }
  }

  return results;
}

export function BatchPerformanceCreator({
  runId,
  venueId,
  startDate,
  endDate,
  onCreated,
  onCancel,
}: BatchPerformanceCreatorProps) {
  const [mode, setMode] = useState<"quick" | "cadence">("quick");

  // Quick add state
  const [quickRows, setQuickRows] = useState<PerformanceRow[]>([
    { date: "", time: "7:30 PM" },
  ]);

  // Cadence state
  const [selectedDays, setSelectedDays] = useState<Set<number>>(new Set([4, 5, 6, 0])); // Thu-Sun
  const [showtimes, setShowtimes] = useState(["7:30 PM"]);
  const [cadenceStart, setCadenceStart] = useState(startDate || "");
  const [cadenceEnd, setCadenceEnd] = useState(endDate || "");

  const [, executeCreate] = useMutation(PERFORMANCE_CREATE_MUTATION);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<string | null>(null);

  // Get the performances to create based on mode
  function getPerformances(): PerformanceRow[] {
    if (mode === "quick") {
      return quickRows.filter((r) => r.date && r.time);
    }
    if (!cadenceStart || !cadenceEnd) return [];
    return generateCadencePerformances(
      cadenceStart,
      cadenceEnd,
      selectedDays,
      showtimes.filter(Boolean)
    );
  }

  const performances = getPerformances();

  async function handleCreate() {
    if (performances.length === 0) return;

    setCreating(true);
    setError(null);
    setProgress(`Creating 0/${performances.length}...`);

    let created = 0;
    let failed = 0;

    for (const perf of performances) {
      const result = await executeCreate({
        input: {
          runId,
          venueId,
          date: new Date(perf.date).toISOString(),
          time: perf.time,
        },
      });

      if (result.error || result.data?.performanceCreate?.error) {
        failed++;
      } else {
        created++;
      }
      setProgress(`Creating ${created + failed}/${performances.length}...`);
    }

    setCreating(false);
    setProgress(null);

    if (failed > 0) {
      setError(`Created ${created}, failed ${failed}`);
    }
    if (created > 0) {
      onCreated();
    }
  }

  function toggleDay(day: number) {
    setSelectedDays((prev) => {
      const next = new Set(prev);
      if (next.has(day)) next.delete(day);
      else next.add(day);
      return next;
    });
  }

  function addQuickRow() {
    setQuickRows((prev) => [...prev, { date: "", time: "7:30 PM" }]);
  }

  function removeQuickRow(idx: number) {
    setQuickRows((prev) => prev.filter((_, i) => i !== idx));
  }

  function updateQuickRow(idx: number, field: keyof PerformanceRow, value: string) {
    setQuickRows((prev) =>
      prev.map((r, i) => (i === idx ? { ...r, [field]: value } : r))
    );
  }

  function addShowtime() {
    setShowtimes((prev) => [...prev, ""]);
  }

  function removeShowtime(idx: number) {
    setShowtimes((prev) => prev.filter((_, i) => i !== idx));
  }

  function updateShowtime(idx: number, value: string) {
    setShowtimes((prev) => prev.map((t, i) => (i === idx ? value : t)));
  }

  return (
    <div className="dinn-panel space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xs uppercase tracking-widest text-curtn-muted">
          Add Performances
        </h2>
        <button
          type="button"
          onClick={onCancel}
          className="text-xs text-curtn-muted hover:text-curtn-cream transition-colors cursor-pointer"
        >
          Cancel
        </button>
      </div>

      {/* Mode toggle */}
      <div className="flex rounded-lg border border-curtn-dark overflow-hidden text-xs">
        <button
          type="button"
          onClick={() => setMode("quick")}
          className={`flex-1 px-3 py-1.5 transition-colors cursor-pointer ${
            mode === "quick"
              ? "bg-curtn-dark text-curtn-cream"
              : "text-curtn-muted hover:text-curtn-cream"
          }`}
        >
          Quick Add
        </button>
        <button
          type="button"
          onClick={() => setMode("cadence")}
          className={`flex-1 px-3 py-1.5 transition-colors cursor-pointer ${
            mode === "cadence"
              ? "bg-curtn-dark text-curtn-cream"
              : "text-curtn-muted hover:text-curtn-cream"
          }`}
        >
          Cadence
        </button>
      </div>

      {/* Quick add mode */}
      {mode === "quick" && (
        <div className="space-y-3">
          {quickRows.map((row, i) => (
            <div key={i} className="flex items-end gap-2">
              <div className="flex-1">
                <Input
                  label={`Date ${i + 1}`}
                  type="date"
                  value={row.date}
                  onChange={(e) => updateQuickRow(i, "date", e.target.value)}
                />
              </div>
              <div className="w-28">
                <Input
                  label="Time"
                  value={row.time}
                  onChange={(e) => updateQuickRow(i, "time", e.target.value)}
                  placeholder="7:30 PM"
                />
              </div>
              {quickRows.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeQuickRow(i)}
                  className="text-curtn-muted/50 hover:text-curtn-red text-xs pb-1 cursor-pointer"
                >
                  Remove
                </button>
              )}
            </div>
          ))}
          {quickRows.length < 10 && (
            <button
              type="button"
              onClick={addQuickRow}
              className="text-xs text-curtn-coral hover:underline cursor-pointer"
            >
              + Add another date
            </button>
          )}
        </div>
      )}

      {/* Cadence mode */}
      {mode === "cadence" && (
        <div className="space-y-4">
          <div className="flex gap-2">
            <div className="flex-1">
              <Input
                label="Start Date"
                type="date"
                value={cadenceStart}
                onChange={(e) => setCadenceStart(e.target.value)}
              />
            </div>
            <div className="flex-1">
              <Input
                label="End Date"
                type="date"
                value={cadenceEnd}
                onChange={(e) => setCadenceEnd(e.target.value)}
              />
            </div>
          </div>

          {/* Day picker */}
          <div>
            <label className="font-mono text-[10px] uppercase tracking-[1px] text-curtn-muted block mb-2">
              Days of Week
            </label>
            <div className="flex gap-1">
              {DAYS_OF_WEEK.map((day) => (
                <button
                  key={day.key}
                  type="button"
                  onClick={() => toggleDay(day.key)}
                  className={`w-10 py-1.5 text-xs rounded-sm transition-colors cursor-pointer ${
                    selectedDays.has(day.key)
                      ? "bg-curtn-coral text-curtn-deep font-bold"
                      : "bg-curtn-dark/50 text-curtn-muted hover:text-curtn-cream"
                  }`}
                >
                  {day.label}
                </button>
              ))}
            </div>
          </div>

          {/* Showtimes */}
          <div>
            <label className="font-mono text-[10px] uppercase tracking-[1px] text-curtn-muted block mb-2">
              Showtimes
            </label>
            <div className="space-y-2">
              {showtimes.map((time, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Input
                    label=""
                    value={time}
                    onChange={(e) => updateShowtime(i, e.target.value)}
                    placeholder="7:30 PM"
                  />
                  {showtimes.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeShowtime(i)}
                      className="text-curtn-muted/50 hover:text-curtn-red text-xs cursor-pointer"
                    >
                      Remove
                    </button>
                  )}
                </div>
              ))}
              <button
                type="button"
                onClick={addShowtime}
                className="text-xs text-curtn-coral hover:underline cursor-pointer"
              >
                + Add showtime
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Preview count */}
      {performances.length > 0 && (
        <p className="text-xs text-curtn-muted">
          Will create <span className="text-curtn-cream font-medium">{performances.length}</span>{" "}
          performance{performances.length !== 1 ? "s" : ""}
        </p>
      )}

      {error && <p className="text-xs text-curtn-red">{error}</p>}
      {progress && <p className="text-xs text-curtn-coral">{progress}</p>}

      {/* Actions */}
      <div className="flex gap-2">
        <Button
          variant="primary"
          size="sm"
          onClick={handleCreate}
          disabled={creating || performances.length === 0}
        >
          {creating ? "Creating..." : `Create ${performances.length} Performance${performances.length !== 1 ? "s" : ""}`}
        </Button>
        <Button variant="tertiary" size="sm" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
