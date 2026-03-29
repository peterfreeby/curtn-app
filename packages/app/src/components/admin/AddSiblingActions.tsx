"use client";

import { useState } from "react";
import { useMutation } from "urql";
import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
import { RUN_FIND_OR_CREATE_MUTATION } from "@/lib/graphql/runs";
import { PERFORMANCE_CREATE_MUTATION } from "@/lib/graphql/performances";

interface AddRunFormProps {
  showId: string; // Global ID
  onCreated: (runId: string) => void;
  onCancel: () => void;
}

function AddRunForm({ showId, onCreated, onCancel }: AddRunFormProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [{ fetching }, execute] = useMutation(RUN_FIND_OR_CREATE_MUTATION);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    setError(null);
    const result = await execute({
      input: {
        showId,
        description: description || undefined,
      },
    });

    const data = result.data?.runFindOrCreate;
    if (result.error) {
      setError(result.error.message);
    } else if (data?.error) {
      setError(data.error);
    } else if (data?.run?.id) {
      onCreated(data.run.id);
    }
  }

  return (
    <div className="dinn-panel space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-xs uppercase tracking-widest text-curtn-muted">
          Add Another Production
        </h2>
        <button
          type="button"
          onClick={onCancel}
          className="text-xs text-curtn-muted hover:text-curtn-cream transition-colors cursor-pointer"
        >
          Cancel
        </button>
      </div>

      <Input
        label="Production Title (optional)"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="e.g. 2026 Broadway Revival"
      />
      <Input
        label="Description (optional)"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Notes about this production"
      />

      {error && <p className="text-xs text-curtn-red">{error}</p>}

      <div className="flex gap-2">
        <Button variant="primary" size="sm" onClick={handleSubmit} disabled={fetching}>
          {fetching ? "Creating..." : "Create Production"}
        </Button>
        <Button variant="tertiary" size="sm" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

interface AddPerformanceFormProps {
  runId: string; // Global ID
  venueId: string; // Global ID
  onCreated: () => void;
  onCancel: () => void;
}

function AddPerformanceForm({ runId, venueId, onCreated, onCancel }: AddPerformanceFormProps) {
  const [date, setDate] = useState("");
  const [time, setTime] = useState("7:30 PM");
  const [{ fetching }, execute] = useMutation(PERFORMANCE_CREATE_MUTATION);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    if (!date) {
      setError("Date is required");
      return;
    }
    setError(null);
    const result = await execute({
      input: {
        runId,
        venueId,
        date: new Date(date).toISOString(),
        time,
      },
    });

    const data = result.data?.performanceCreate;
    if (result.error) {
      setError(result.error.message);
    } else if (data?.error) {
      setError(data.error);
    } else {
      onCreated();
    }
  }

  return (
    <div className="dinn-panel space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-xs uppercase tracking-widest text-curtn-muted">
          Add Another Date
        </h2>
        <button
          type="button"
          onClick={onCancel}
          className="text-xs text-curtn-muted hover:text-curtn-cream transition-colors cursor-pointer"
        >
          Cancel
        </button>
      </div>

      <div className="flex gap-2">
        <div className="flex-1">
          <Input label="Date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div className="w-28">
          <Input label="Time" value={time} onChange={(e) => setTime(e.target.value)} placeholder="7:30 PM" />
        </div>
      </div>

      {error && <p className="text-xs text-curtn-red">{error}</p>}

      <div className="flex gap-2">
        <Button variant="primary" size="sm" onClick={handleSubmit} disabled={fetching || !date}>
          {fetching ? "Adding..." : "Add Date"}
        </Button>
        <Button variant="tertiary" size="sm" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

// --- Exported component that renders the right buttons/forms ---

interface AddSiblingActionsProps {
  showId: string; // Global ID
  runId?: string; // Global ID (when on a run or absorbed run)
  venueId?: string; // Global ID (for performance creation)
  showAddRun?: boolean;
  showAddPerformance?: boolean;
  onRunCreated?: (runId: string) => void;
  onPerformanceCreated?: () => void;
}

export function AddSiblingActions({
  showId,
  runId,
  venueId,
  showAddRun = false,
  showAddPerformance = false,
  onRunCreated,
  onPerformanceCreated,
}: AddSiblingActionsProps) {
  const [mode, setMode] = useState<"idle" | "addRun" | "addPerformance">("idle");

  if (mode === "addRun") {
    return (
      <AddRunForm
        showId={showId}
        onCreated={(id) => {
          setMode("idle");
          onRunCreated?.(id);
        }}
        onCancel={() => setMode("idle")}
      />
    );
  }

  if (mode === "addPerformance" && runId && venueId) {
    return (
      <AddPerformanceForm
        runId={runId}
        venueId={venueId}
        onCreated={() => {
          setMode("idle");
          onPerformanceCreated?.();
        }}
        onCancel={() => setMode("idle")}
      />
    );
  }

  return (
    <div className="flex gap-2">
      {showAddRun && (
        <Button variant="tertiary" size="sm" icon="plus" onClick={() => setMode("addRun")}>
          Add Production
        </Button>
      )}
      {showAddPerformance && runId && venueId && (
        <Button variant="tertiary" size="sm" icon="plus" onClick={() => setMode("addPerformance")}>
          Add Date
        </Button>
      )}
    </div>
  );
}
