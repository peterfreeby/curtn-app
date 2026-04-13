"use client";

import { useState } from "react";
import { useMutation } from "urql";
import { Icon } from "@/components/icons/Icons";
import { useAuth } from "@/lib/auth/useAuth";
import {
  WATCHLIST_ADD_MUTATION,
  WATCHLIST_REMOVE_MUTATION,
} from "@/lib/graphql/watchlist";

interface WatchlistButtonProps {
  showId: string;
  initialIsOnWatchlist: boolean;
  initialWatchlistCount: number;
}

export function WatchlistButton({
  showId,
  initialIsOnWatchlist,
  initialWatchlistCount,
}: WatchlistButtonProps) {
  const { user } = useAuth();
  const [isOn, setIsOn] = useState(initialIsOnWatchlist);
  const [count, setCount] = useState(initialWatchlistCount);

  const [, executeAdd] = useMutation(WATCHLIST_ADD_MUTATION);
  const [, executeRemove] = useMutation(WATCHLIST_REMOVE_MUTATION);

  if (!user) return null;

  async function handleToggle() {
    const wasOn = isOn;
    const prevCount = count;

    // Optimistic update
    setIsOn(!wasOn);
    setCount(wasOn ? prevCount - 1 : prevCount + 1);

    const execute = wasOn ? executeRemove : executeAdd;
    const result = await execute({ input: { showId } });

    const payload = wasOn
      ? result.data?.watchlistRemove
      : result.data?.watchlistAdd;

    if (result.error || payload?.error) {
      // Revert on failure
      setIsOn(wasOn);
      setCount(prevCount);
    } else if (payload) {
      // Sync with server truth
      setIsOn(payload.onWatchlist);
      setCount(payload.watchlistCount);
    }
  }

  return (
    <button
      type="button"
      onClick={handleToggle}
      className={
        isOn
          ? "inline-flex h-10 items-center gap-2 border border-curtn-coral/30 bg-curtn-coral/10 px-4 text-sm text-curtn-coral transition-colors hover:bg-curtn-coral/20 cursor-pointer"
          : "inline-flex h-10 items-center gap-2 border border-curtn-dark px-4 text-sm text-curtn-muted transition-colors hover:border-curtn-muted/50 hover:text-curtn-cream cursor-pointer"
      }
    >
      <Icon
        name={isOn ? "eye" : "eye"}
        weight={isOn ? "fill" : "regular"}
        size={16}
      />
      {isOn ? "On your watchlist" : "Want to see"}
      {count > 0 && (
        <span className="text-xs text-curtn-muted/60 ml-1">
          ({count})
        </span>
      )}
    </button>
  );
}
