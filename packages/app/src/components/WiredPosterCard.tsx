"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "urql";
import { PosterCard, type PosterAction } from "@/components/PosterCard";
import {
  WATCHLIST_ADD_MUTATION,
  WATCHLIST_REMOVE_MUTATION,
} from "@/lib/graphql/watchlist";
import { useAuth } from "@/lib/auth/useAuth";

interface RunOption {
  id: string;
  label: string;
}

interface WiredPosterCardProps {
  showId: string;
  imageUrl?: string | null;
  title: string;
  subtitle?: string;
  href?: string;
  size?: "sm" | "md" | "lg";
  className?: string;
  /** Pre-resolved single run ID — skips the picker */
  runId?: string | null;
  /** Multiple runs for the picker popup */
  runs?: RunOption[];
  /** Watchlist state */
  isOnWatchlist?: boolean;
  /** Ticket URL (only for single-run/single-perf shows) */
  ticketUrl?: string | null;
}

export function WiredPosterCard({
  showId,
  imageUrl,
  title,
  subtitle,
  href,
  size = "md",
  className,
  runId,
  runs,
  isOnWatchlist: initialWatchlist = false,
  ticketUrl,
}: WiredPosterCardProps) {
  const router = useRouter();
  const { user } = useAuth();
  const [isOnWatchlist, setIsOnWatchlist] = useState(initialWatchlist);
  const [showRunPicker, setShowRunPicker] = useState<"log" | null>(null);

  const [, executeAdd] = useMutation(WATCHLIST_ADD_MUTATION);
  const [, executeRemove] = useMutation(WATCHLIST_REMOVE_MUTATION);

  function handleLog() {
    if (!user) {
      router.push("/login");
      return;
    }
    // Single run → go straight to log
    if (runId) {
      router.push(`/log?run=${runId}`);
      return;
    }
    // Multiple runs → show picker
    if (runs && runs.length > 1) {
      setShowRunPicker("log");
      return;
    }
    // Fallback: first run if available
    if (runs && runs.length === 1) {
      router.push(`/log?run=${runs[0].id}`);
      return;
    }
    // No runs — go to detail page
    router.push(`/performances/${showId}`);
  }

  async function handleWatchlistToggle() {
    if (!user) {
      router.push("/login");
      return;
    }
    const wasOn = isOnWatchlist;
    setIsOnWatchlist(!wasOn);

    const execute = wasOn ? executeRemove : executeAdd;
    const result = await execute({ input: { showId } });
    const payload = wasOn
      ? result.data?.watchlistRemove
      : result.data?.watchlistAdd;

    if (result.error || payload?.error) {
      setIsOnWatchlist(wasOn);
    } else if (payload) {
      setIsOnWatchlist(payload.onWatchlist);
    }
  }

  function handleTicket() {
    if (ticketUrl) {
      window.open(ticketUrl, "_blank", "noopener,noreferrer");
    } else {
      // No ticket URL — go to detail page
      router.push(`/performances/${showId}`);
    }
  }

  const actions: PosterAction[] = [
    {
      icon: "eye",
      label: "Log",
      onClick: handleLog,
    },
    {
      icon: "clock-countdown",
      activeIcon: "clock-countdown",
      active: isOnWatchlist,
      label: "Watchlist",
      onClick: handleWatchlistToggle,
    },
    {
      icon: "ticket",
      label: "Tickets",
      onClick: handleTicket,
    },
  ];

  return (
    <div className="relative">
      <PosterCard
        imageUrl={imageUrl}
        title={title}
        subtitle={subtitle}
        href={href}
        size={size}
        className={className}
        actions={actions}
      />

      {/* Run picker popup */}
      {showRunPicker && runs && runs.length > 1 && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setShowRunPicker(null)}
          />
          <div className="absolute bottom-full left-0 right-0 z-50 mb-1 rounded-lg border border-curtn-dark/50 bg-curtn-surface shadow-xl overflow-hidden">
            <p className="px-3 pt-2 pb-1 text-[10px] uppercase tracking-wider text-curtn-muted">
              Which production?
            </p>
            {runs.map((run) => (
              <button
                key={run.id}
                type="button"
                onClick={() => {
                  setShowRunPicker(null);
                  router.push(`/log?run=${run.id}`);
                }}
                className="w-full px-3 py-2 text-left text-xs text-curtn-cream hover:bg-curtn-dark/30 transition-colors cursor-pointer"
              >
                {run.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
