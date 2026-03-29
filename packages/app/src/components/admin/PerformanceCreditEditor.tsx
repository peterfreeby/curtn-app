"use client";

import { useState } from "react";
import { useMutation } from "urql";
import Link from "next/link";
import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
import {
  PERFORMANCE_CREDIT_REMOVE_MUTATION,
  PERFORMANCE_CREDIT_RESTORE_MUTATION,
  PERFORMANCE_CREDIT_ADD_MUTATION,
} from "@/lib/graphql/performances";

interface Credit {
  id: string;
  role: string;
  person: { id: string; name: string; slug: string };
}

interface PerformanceCreditEditorProps {
  performanceId: string; // MongoDB ObjectId
  effectiveCast: Credit[];
  effectiveCrew: Credit[];
  onChanged: () => void;
}

export function PerformanceCreditEditor({
  performanceId,
  effectiveCast,
  effectiveCrew,
  onChanged,
}: PerformanceCreditEditorProps) {
  const [, executeRemove] = useMutation(PERFORMANCE_CREDIT_REMOVE_MUTATION);
  const [, executeRestore] = useMutation(PERFORMANCE_CREDIT_RESTORE_MUTATION);
  const [, executeAdd] = useMutation(PERFORMANCE_CREDIT_ADD_MUTATION);

  const [removing, setRemoving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Add guest form
  const [showAddForm, setShowAddForm] = useState(false);
  const [guestName, setGuestName] = useState("");
  const [guestRole, setGuestRole] = useState("");
  const [guestType, setGuestType] = useState<"cast" | "crew">("cast");
  const [adding, setAdding] = useState(false);

  async function handleSubOut(creditId: string) {
    setError(null);
    setRemoving(creditId);
    // Extract MongoDB ObjectId from global ID
    const mongoId = atob(creditId).split(":")[1];
    const result = await executeRemove({ input: { performanceId, creditId: mongoId } });
    setRemoving(null);
    if (result.data?.performanceCreditRemove?.error) {
      setError(result.data.performanceCreditRemove.error);
    } else {
      onChanged();
    }
  }

  async function handleAddGuest() {
    if (!guestName || !guestRole) return;
    setError(null);
    setAdding(true);
    const result = await executeAdd({
      input: {
        performanceId,
        personName: guestName,
        creditType: guestType,
        role: guestRole,
      },
    });
    setAdding(false);
    if (result.data?.performanceCreditAdd?.error) {
      setError(result.data.performanceCreditAdd.error);
    } else {
      setGuestName("");
      setGuestRole("");
      setShowAddForm(false);
      onChanged();
    }
  }

  function CreditRow({ credit, type }: { credit: Credit; type: string }) {
    return (
      <div className="flex items-center justify-between py-1.5 border-b border-curtn-dark/30">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-sm text-curtn-cream truncate">{credit.person.name}</span>
          <span className="text-xs text-curtn-muted">{credit.role}</span>
        </div>
        <button
          type="button"
          onClick={() => handleSubOut(credit.id)}
          disabled={removing === credit.id}
          className="text-xs text-curtn-muted hover:text-curtn-red transition-colors cursor-pointer disabled:opacity-40 shrink-0"
        >
          {removing === credit.id ? "..." : "Sub out"}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-curtn-muted">
        Inherited from run. Sub out to remove for this date, or add a guest.
      </p>

      {effectiveCast.length > 0 && (
        <div>
          <h3 className="font-mono text-[10px] uppercase tracking-[1px] text-curtn-muted mb-1">
            Cast ({effectiveCast.length})
          </h3>
          {effectiveCast.map((c) => (
            <CreditRow key={c.id} credit={c} type="cast" />
          ))}
        </div>
      )}

      {effectiveCrew.length > 0 && (
        <div>
          <h3 className="font-mono text-[10px] uppercase tracking-[1px] text-curtn-muted mb-1">
            Crew ({effectiveCrew.length})
          </h3>
          {effectiveCrew.map((c) => (
            <CreditRow key={c.id} credit={c} type="crew" />
          ))}
        </div>
      )}

      {effectiveCast.length === 0 && effectiveCrew.length === 0 && (
        <p className="text-xs text-curtn-muted/60">No inherited credits for this performance.</p>
      )}

      {error && <p className="text-xs text-curtn-red">{error}</p>}

      {/* Add guest form */}
      {!showAddForm ? (
        <button
          type="button"
          onClick={() => setShowAddForm(true)}
          className="text-xs text-curtn-coral hover:underline cursor-pointer"
        >
          + Add guest / sub-in
        </button>
      ) : (
        <div className="space-y-2 border-t border-curtn-dark/40 pt-3">
          <div className="flex gap-2">
            <div className="flex-1">
              <Input
                label="Name"
                value={guestName}
                onChange={(e) => setGuestName(e.target.value)}
                placeholder="Person name"
              />
            </div>
            <div className="flex-1">
              <Input
                label="Role"
                value={guestRole}
                onChange={(e) => setGuestRole(e.target.value)}
                placeholder="e.g. Hamlet, Director"
              />
            </div>
          </div>
          <div className="flex gap-2 items-center">
            <div className="flex rounded-lg border border-curtn-dark overflow-hidden text-xs">
              <button
                type="button"
                onClick={() => setGuestType("cast")}
                className={`px-2.5 py-1 transition-colors cursor-pointer ${guestType === "cast" ? "bg-curtn-dark text-curtn-cream" : "text-curtn-muted"}`}
              >
                Cast
              </button>
              <button
                type="button"
                onClick={() => setGuestType("crew")}
                className={`px-2.5 py-1 transition-colors cursor-pointer ${guestType === "crew" ? "bg-curtn-dark text-curtn-cream" : "text-curtn-muted"}`}
              >
                Crew
              </button>
            </div>
            <Button variant="primary" size="sm" onClick={handleAddGuest} disabled={adding || !guestName || !guestRole}>
              {adding ? "Adding..." : "Add"}
            </Button>
            <button
              type="button"
              onClick={() => setShowAddForm(false)}
              className="text-xs text-curtn-muted hover:text-curtn-cream cursor-pointer"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
