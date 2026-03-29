"use client";

import { useState } from "react";
import { useMutation } from "urql";
import { Input } from "@/components/Input";
import { Button } from "@/components/Button";
import { Icon } from "@/components/icons/Icons";
import {
  SHOW_UPDATE_MUTATION,
  RUN_UPDATE_MUTATION,
  PERFORMANCE_UPDATE_MUTATION,
} from "@/lib/graphql/admin";

// --- Field definitions per entity type ---

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

// --- Component ---

interface InlineEditorProps {
  entityType: "show" | "run" | "performance";
  entityId: string; // MongoDB ObjectId (not global ID)
  initialValues: Record<string, any>;
  onSaved?: () => void;
  onCancel: () => void;
}

export function InlineEditor({
  entityType,
  entityId,
  initialValues,
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

  async function handleSave() {
    setError(null);

    const input: Record<string, string> = { [idField]: entityId };

    // Only send fields that changed
    for (const field of fields) {
      const original = Array.isArray(initialValues[field.key])
        ? initialValues[field.key].join(", ")
        : String(initialValues[field.key] ?? "");
      if (values[field.key] !== original) {
        input[field.key] = values[field.key];
      }
    }

    // Nothing changed
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

  function handleChange(key: string, value: string) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  return (
    <div className="dinn-panel space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xs uppercase tracking-widest text-curtn-muted">
          Edit {entityType}
        </h2>
        <button
          type="button"
          onClick={onCancel}
          className="text-xs text-curtn-muted hover:text-curtn-cream transition-colors cursor-pointer"
        >
          Cancel
        </button>
      </div>

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
                  onChange={(e) => handleChange(field.key, e.target.value)}
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
                  onChange={(e) => handleChange(field.key, e.target.value)}
                  className="bg-transparent border-b border-curtn-dark text-curtn-cream py-[var(--spacing-1)] text-sm outline-none focus:border-curtn-coral transition-colors cursor-pointer"
                >
                  {field.options.map((opt) => (
                    <option key={opt} value={opt} className="bg-curtn-deep">
                      {opt}
                    </option>
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
              onChange={(e) => handleChange(field.key, e.target.value)}
              placeholder={field.placeholder}
            />
          );
        })}
      </div>

      {error && <p className="text-xs text-curtn-red">{error}</p>}

      <div className="flex gap-2">
        <Button
          variant="primary"
          size="sm"
          onClick={handleSave}
          disabled={fetching}
        >
          {fetching ? "Saving..." : "Save"}
        </Button>
        <Button variant="tertiary" size="sm" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
