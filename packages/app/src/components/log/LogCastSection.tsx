"use client";

import { useRef, useState } from "react";
import { PersonSearchInput } from "@/components/credits/PersonSearchInput";

// A cast/crew entry collected in the log form before the run exists. On
// submit the form creates a Credit per entry (order = list index).
export interface CastEntry {
  key: string;
  personId?: string; // set when matched to an existing person
  name: string; // display name; also the personName when isNew
  isNew: boolean;
  creditType: "cast" | "crew";
  role: string; // optional; defaulted at submit
}

interface LogCastSectionProps {
  cast: CastEntry[];
  onChange: (next: CastEntry[]) => void;
}

export function LogCastSection({ cast, onChange }: LogCastSectionProps) {
  const [open, setOpen] = useState(false);
  const [selectedPerson, setSelectedPerson] = useState<{ id: string; name: string; slug: string } | null>(null);
  const [newName, setNewName] = useState("");
  const [creditType, setCreditType] = useState<"cast" | "crew">("cast");
  const [role, setRole] = useState("");
  // Stable keys without relying on array index (entries can be removed).
  const keyCounter = useRef(0);
  // Remount PersonSearchInput after each add to clear its internal query.
  const [searchKey, setSearchKey] = useState(0);

  const pendingName = selectedPerson?.name || newName.trim();

  function addEntry() {
    if (!pendingName) return;
    const entry: CastEntry = {
      key: `c${keyCounter.current++}`,
      personId: selectedPerson?.id,
      name: pendingName,
      isNew: !selectedPerson,
      creditType,
      role: role.trim(),
    };
    onChange([...cast, entry]);
    setSelectedPerson(null);
    setNewName("");
    setRole("");
    setSearchKey((k) => k + 1);
  }

  function removeEntry(key: string) {
    onChange(cast.filter((c) => c.key !== key));
  }

  return (
    <div>
      {!open && cast.length === 0 ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="text-xs text-curtn-muted hover:text-curtn-coral transition-colors cursor-pointer"
        >
          + Tag cast or crew
        </button>
      ) : (
        <div className="space-y-3">
          <span className="text-xs uppercase tracking-widest text-curtn-muted block">
            Cast &amp; Crew
          </span>

          {/* Added entries */}
          {cast.length > 0 && (
            <ul className="space-y-1.5">
              {cast.map((c) => (
                <li
                  key={c.key}
                  className="flex items-center justify-between gap-2 border border-curtn-dark/50 bg-curtn-surface/50 px-3 py-2 text-sm"
                >
                  <span className="text-curtn-cream truncate">
                    {c.name}
                    {c.role && <span className="text-curtn-muted"> · {c.role}</span>}
                    <span className="text-curtn-muted text-xs ml-2 uppercase tracking-wide">
                      {c.creditType}
                    </span>
                    {c.isNew && <span className="text-curtn-coral/60 text-xs ml-2">new</span>}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeEntry(c.key)}
                    aria-label={`Remove ${c.name}`}
                    className="shrink-0 text-curtn-muted hover:text-curtn-red transition-colors cursor-pointer text-xs"
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          )}

          {/* Add-a-person row */}
          <div className="space-y-2">
            <PersonSearchInput
              key={searchKey}
              onSelect={setSelectedPerson}
              onNewName={setNewName}
            />

            <div className="flex items-center gap-2">
              <div className="flex gap-1">
                <button
                  type="button"
                  onClick={() => setCreditType("cast")}
                  className={`px-3 py-1 text-xs transition-colors ${
                    creditType === "cast"
                      ? "bg-curtn-coral text-curtn-deep"
                      : "border border-curtn-dark text-curtn-muted hover:border-curtn-muted/50"
                  }`}
                >
                  Cast
                </button>
                <button
                  type="button"
                  onClick={() => setCreditType("crew")}
                  className={`px-3 py-1 text-xs transition-colors ${
                    creditType === "crew"
                      ? "bg-curtn-coral text-curtn-deep"
                      : "border border-curtn-dark text-curtn-muted hover:border-curtn-muted/50"
                  }`}
                >
                  Crew
                </button>
              </div>
              <input
                type="text"
                value={role}
                onChange={(e) => setRole(e.target.value)}
                placeholder={creditType === "cast" ? "Role (optional)" : "Role (e.g. Director)"}
                className="flex-1 border-b border-curtn-dark bg-transparent px-0 py-1 text-sm text-curtn-cream placeholder:text-curtn-muted/50 focus:border-curtn-coral focus:outline-none"
              />
            </div>

            <button
              type="button"
              onClick={addEntry}
              disabled={!pendingName}
              className="text-xs text-curtn-coral hover:text-curtn-red transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            >
              + Add {pendingName ? `"${pendingName}"` : "person"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
