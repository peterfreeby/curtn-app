"use client";

import { useState } from "react";
import { useMutation } from "urql";
import { Input } from "@/components/Input";
import { Button } from "@/components/Button";
import {
  SHOW_UPDATE_MUTATION,
  RUN_UPDATE_MUTATION,
  PERFORMANCE_UPDATE_MUTATION,
} from "@/lib/graphql/admin";
import { RUN_FIND_OR_CREATE_MUTATION } from "@/lib/graphql/runs";
import { PERFORMANCE_CREATE_MUTATION } from "@/lib/graphql/performances";
import { AddShowCreditForm } from "@/components/credits/AddShowCreditForm";
import { RunCreditEditor } from "@/components/admin/RunCreditEditor";
import { PerformanceCreditEditor } from "@/components/admin/PerformanceCreditEditor";

// --- Field definitions ---

interface FieldDef {
  key: string;
  label: string;
  type?: "text" | "textarea" | "number" | "date" | "url" | "select";
  options?: string[];
  placeholder?: string;
}

const SHOW_FIELDS: FieldDef[] = [
  { key: "title", label: "Title" },
  { key: "description", label: "Description", type: "textarea" },
  { key: "performanceTypes", label: "Performance Types", placeholder: "theater, musical, comedy" },
  { key: "duration", label: "Duration (minutes)", type: "number" },
  { key: "url", label: "Website", type: "url" },
];

const RUN_FIELDS: FieldDef[] = [
  { key: "title", label: "Run Title", placeholder: "e.g. Original Broadway, 2024 Revival" },
  { key: "description", label: "Description", type: "textarea" },
  { key: "intermissions", label: "Intermissions", type: "number" },
  { key: "startDate", label: "Start Date", type: "date" },
  { key: "endDate", label: "End Date", type: "date" },
];

const PERFORMANCE_FIELDS: FieldDef[] = [
  { key: "date", label: "Date", type: "date" },
  { key: "time", label: "Time", placeholder: "7:30 PM" },
  { key: "ticketUrl", label: "Ticket URL", type: "url" },
  { key: "soldOut", label: "Sold Out", type: "select", options: ["false", "true"] },
];

const FIELD_MAP: Record<string, FieldDef[]> = {
  show: SHOW_FIELDS,
  run: RUN_FIELDS,
  performance: PERFORMANCE_FIELDS,
};

const MUTATION_MAP: Record<string, any> = {
  show: SHOW_UPDATE_MUTATION,
  run: RUN_UPDATE_MUTATION,
  performance: PERFORMANCE_UPDATE_MUTATION,
};

const ID_FIELD_MAP: Record<string, string> = {
  show: "showId",
  run: "runId",
  performance: "performanceId",
};

// --- Field renderer ---

function EditorFields({
  fields,
  values,
  onChange,
}: {
  fields: FieldDef[];
  values: Record<string, string>;
  onChange: (key: string, value: string) => void;
}) {
  return (
    <div className="space-y-3">
      {fields.map((field) => {
        if (field.type === "textarea") {
          return (
            <div key={field.key} className="flex flex-col gap-[var(--spacing-1)]">
              <label className="font-mono text-[10px] uppercase tracking-[1px] text-curtn-muted">
                {field.label}
              </label>
              <textarea
                value={values[field.key]}
                onChange={(e) => onChange(field.key, e.target.value)}
                rows={3}
                className="bg-transparent border-b border-curtn-dark text-curtn-cream placeholder:text-curtn-dark py-[var(--spacing-1)] text-sm outline-none focus:border-curtn-coral transition-colors resize-none"
                placeholder={field.placeholder}
              />
            </div>
          );
        }

        if (field.type === "select" && field.options) {
          return (
            <div key={field.key} className="flex flex-col gap-[var(--spacing-1)]">
              <label className="font-mono text-[10px] uppercase tracking-[1px] text-curtn-muted">
                {field.label}
              </label>
              <select
                value={values[field.key]}
                onChange={(e) => onChange(field.key, e.target.value)}
                className="bg-transparent border-b border-curtn-dark text-curtn-cream py-[var(--spacing-1)] text-sm outline-none focus:border-curtn-coral transition-colors cursor-pointer"
              >
                {field.options.map((opt) => (
                  <option key={opt} value={opt} className="bg-curtn-deep">{opt}</option>
                ))}
              </select>
            </div>
          );
        }

        return (
          <Input
            key={field.key}
            label={field.label}
            type={field.type || "text"}
            value={values[field.key]}
            onChange={(e) => onChange(field.key, e.target.value)}
            placeholder={field.placeholder}
          />
        );
      })}
    </div>
  );
}

// --- Main InlineEditor ---

interface CreditData {
  id: string;
  role: string;
  person: { id: string; name: string; slug: string };
}

interface InlineEditorProps {
  entityType: "show" | "run" | "performance";
  entityId: string; // MongoDB ObjectId
  initialValues: Record<string, any>;
  // Child creation props
  showId?: string; // Global ID — for "add run" on show editor, "add show credit"
  runId?: string; // Global ID — for "add performance" on run editor, "add credit"
  venueId?: string; // Global ID — for performance creation
  // Performance credit override props
  effectiveCast?: CreditData[];
  effectiveCrew?: CreditData[];
  onSaved?: () => void;
  onCancel: () => void;
}

export function InlineEditor({
  entityType,
  entityId,
  initialValues,
  showId,
  runId,
  effectiveCast,
  effectiveCrew,
  venueId,
  onSaved,
  onCancel,
}: InlineEditorProps) {
  const fields = FIELD_MAP[entityType];
  const mutation = MUTATION_MAP[entityType];
  const idField = ID_FIELD_MAP[entityType];

  const [values, setValues] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    for (const field of fields) {
      const val = initialValues[field.key];
      if (Array.isArray(val)) {
        init[field.key] = val.join(", ");
      } else if (val != null) {
        init[field.key] = String(val);
      } else {
        init[field.key] = "";
      }
    }
    return init;
  });

  const [{ fetching }, executeMutation] = useMutation(mutation);
  const [error, setError] = useState<string | null>(null);
  const [section, setSection] = useState<"fields" | "addChild" | "credits">("fields");

  // Child creation state
  const [childDate, setChildDate] = useState("");
  const [childTime, setChildTime] = useState("7:30 PM");
  const [, executeRunCreate] = useMutation(RUN_FIND_OR_CREATE_MUTATION);
  const [, executePerfCreate] = useMutation(PERFORMANCE_CREATE_MUTATION);
  const [childError, setChildError] = useState<string | null>(null);
  const [childCreating, setChildCreating] = useState(false);

  async function handleSave() {
    setError(null);
    const input: Record<string, string> = { [idField]: entityId };

    for (const field of fields) {
      const original = Array.isArray(initialValues[field.key])
        ? initialValues[field.key].join(", ")
        : String(initialValues[field.key] ?? "");
      if (values[field.key] !== original) {
        input[field.key] = values[field.key];
      }
    }

    if (Object.keys(input).length === 1) {
      onCancel();
      return;
    }

    const result = await executeMutation({ input });
    const data = result.data?.[`${entityType}Update`];

    if (result.error) {
      setError(result.error.message);
    } else if (data?.error) {
      setError(data.error);
    } else {
      onSaved?.();
    }
  }

  async function handleAddChild() {
    setChildError(null);
    setChildCreating(true);

    if (entityType === "show" && showId) {
      // Add a run
      const result = await executeRunCreate({ input: { showId } });
      const data = result.data?.runFindOrCreate;
      if (result.error || data?.error) {
        setChildError(data?.error || result.error?.message || "Failed");
      } else {
        onSaved?.();
      }
    } else if (entityType === "run" && runId && venueId && childDate) {
      // Add a performance
      const result = await executePerfCreate({
        input: {
          runId,
          venueId,
          date: new Date(childDate).toISOString(),
          time: childTime,
        },
      });
      const data = result.data?.performanceCreate;
      if (result.error || data?.error) {
        setChildError(data?.error || result.error?.message || "Failed");
      } else {
        setChildDate("");
        setChildTime("7:30 PM");
        onSaved?.();
      }
    }

    setChildCreating(false);
  }

  function handleChange(key: string, value: string) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  const canAddChild =
    (entityType === "show" && showId) ||
    (entityType === "run" && runId && venueId);

  const canAddCredits =
    (entityType === "show" && showId) ||
    (entityType === "run" && runId) ||
    (entityType === "performance" && (effectiveCast?.length || effectiveCrew?.length));

  const childLabel = entityType === "show" ? "Add Production" : "Add Performance";

  // Build tabs
  const tabs: { key: string; label: string }[] = [{ key: "fields", label: `Edit ${entityType}` }];
  if (canAddChild) tabs.push({ key: "addChild", label: childLabel });
  if (canAddCredits) tabs.push({ key: "credits", label: "Credits" });

  return (
    <div className="dinn-panel space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xs uppercase tracking-widest text-curtn-muted">
          {entityType === "show" ? "Show" : entityType === "run" ? "Production" : "Performance"} Editor
        </h2>
        <button
          type="button"
          onClick={onCancel}
          className="text-xs text-curtn-muted hover:text-curtn-cream transition-colors cursor-pointer"
        >
          Close
        </button>
      </div>

      {/* Section tabs */}
      {tabs.length > 1 && (
        <div className="flex rounded-lg border border-curtn-dark overflow-hidden text-xs">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setSection(tab.key as any)}
              className={`flex-1 px-2.5 py-1.5 transition-colors cursor-pointer ${
                section === tab.key
                  ? "bg-curtn-dark text-curtn-cream"
                  : "text-curtn-muted hover:text-curtn-cream"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      )}

      {/* Edit fields */}
      {section === "fields" && (
        <>
          <EditorFields fields={fields} values={values} onChange={handleChange} />
          {error && <p className="text-xs text-curtn-red">{error}</p>}
          <div className="flex gap-2">
            <Button variant="primary" size="sm" onClick={handleSave} disabled={fetching}>
              {fetching ? "Saving..." : "Save"}
            </Button>
            <Button variant="tertiary" size="sm" onClick={onCancel}>
              Cancel
            </Button>
          </div>
        </>
      )}

      {/* Add child */}
      {section === "addChild" && entityType === "show" && showId && (
        <div className="space-y-3">
          <p className="text-xs text-curtn-muted">Create a new production of this show.</p>
          {childError && <p className="text-xs text-curtn-red">{childError}</p>}
          <Button variant="primary" size="sm" onClick={handleAddChild} disabled={childCreating}>
            {childCreating ? "Creating..." : "Create Production"}
          </Button>
        </div>
      )}

      {section === "addChild" && entityType === "run" && runId && venueId && (
        <div className="space-y-3">
          <div className="flex gap-2">
            <div className="flex-1">
              <Input label="Date" type="date" value={childDate} onChange={(e) => setChildDate(e.target.value)} />
            </div>
            <div className="w-28">
              <Input label="Time" value={childTime} onChange={(e) => setChildTime(e.target.value)} placeholder="7:30 PM" />
            </div>
          </div>
          {childError && <p className="text-xs text-curtn-red">{childError}</p>}
          <Button variant="primary" size="sm" onClick={handleAddChild} disabled={childCreating || !childDate}>
            {childCreating ? "Adding..." : "Add Performance"}
          </Button>
        </div>
      )}

      {/* Credits */}
      {section === "credits" && entityType === "show" && showId && (
        <AddShowCreditForm showId={showId} onAdded={() => onSaved?.()} />
      )}

      {section === "credits" && entityType === "run" && runId && (
        <RunCreditEditor
          runId={runId}
          showId={showId}
          cast={effectiveCast ?? []}
          crew={effectiveCrew ?? []}
          onChanged={() => onSaved?.()}
        />
      )}

      {section === "credits" && entityType === "performance" && (
        <PerformanceCreditEditor
          performanceId={entityId}
          effectiveCast={effectiveCast ?? []}
          effectiveCrew={effectiveCrew ?? []}
          onChanged={() => onSaved?.()}
        />
      )}
    </div>
  );
}
