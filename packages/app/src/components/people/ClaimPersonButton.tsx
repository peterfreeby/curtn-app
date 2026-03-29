"use client";

import { useState } from "react";
import { useMutation } from "urql";
import Link from "next/link";
import { USER_CLAIM_PERSON_MUTATION } from "@/lib/graphql/users";
import { useAuth } from "@/lib/auth/useAuth";

interface ClaimPersonButtonProps {
  personId: string;
  isClaimed: boolean;
  claimedByUser?: { id: string; username: string } | null;
  onClaimed?: () => void;
}

export function ClaimPersonButton({
  personId,
  isClaimed,
  claimedByUser,
  onClaimed,
}: ClaimPersonButtonProps) {
  const { user } = useAuth();
  const [{ fetching }, executeClaim] = useMutation(USER_CLAIM_PERSON_MUTATION);
  const [error, setError] = useState<string | null>(null);

  if (!user) return null;

  // Already claimed by the current user
  if (isClaimed && claimedByUser?.id === user.id) {
    return (
      <p className="text-xs text-curtn-muted">
        This is you &middot;{" "}
        <Link href={`/u/${claimedByUser.username}`} className="text-curtn-coral hover:underline">
          View your profile
        </Link>
      </p>
    );
  }

  // Already claimed by someone else
  if (isClaimed && claimedByUser) {
    return (
      <p className="text-xs text-curtn-muted">
        Claimed by{" "}
        <Link href={`/u/${claimedByUser.username}`} className="text-curtn-coral hover:underline">
          @{claimedByUser.username}
        </Link>
      </p>
    );
  }

  async function handleClaim() {
    setError(null);
    const result = await executeClaim({ input: { personId } });
    if (result.data?.userClaimPerson?.error) {
      setError(result.data.userClaimPerson.error);
    } else if (result.error) {
      setError("Something went wrong");
    } else {
      onClaimed?.();
    }
  }

  return (
    <div className="space-y-1">
      <button
        type="button"
        onClick={handleClaim}
        disabled={fetching}
        className="rounded-lg border border-curtn-dark bg-curtn-deep px-3 py-1.5 text-xs text-curtn-cream hover:border-curtn-coral transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {fetching ? "Claiming..." : "This is me"}
      </button>
      {error && <p className="text-xs text-curtn-red">{error}</p>}
    </div>
  );
}
