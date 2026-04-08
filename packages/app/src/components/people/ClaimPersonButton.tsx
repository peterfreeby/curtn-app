"use client";

import { useState } from "react";
import { useMutation, useQuery } from "urql";
import Link from "next/link";
import { SUBMIT_CLAIM_REQUEST_MUTATION, MY_CLAIM_REQUEST_QUERY } from "@/lib/graphql/claims";
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
  const [{ fetching }, submitClaim] = useMutation(SUBMIT_CLAIM_REQUEST_MUTATION);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [message, setMessage] = useState("");
  const [{ data: claimData }] = useQuery({
    query: MY_CLAIM_REQUEST_QUERY,
    pause: !user,
    requestPolicy: "cache-first",
  });

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

  // User has a pending claim
  const pendingClaim = claimData?.myClaimRequest;
  if (submitted || pendingClaim) {
    return (
      <p className="text-xs text-curtn-muted">
        Request pending
      </p>
    );
  }

  async function handleSubmit() {
    setError(null);
    const result = await submitClaim({ input: { personId, message: message || undefined } });
    if (result.data?.submitClaimRequest?.error) {
      setError(result.data.submitClaimRequest.error);
    } else if (result.error) {
      setError("Something went wrong");
    } else {
      setSubmitted(true);
      setShowModal(false);
      onClaimed?.();
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setShowModal(true)}
        className="flex items-center gap-1.5 border border-curtn-dark px-3 py-1.5 text-xs text-curtn-muted transition-colors hover:border-curtn-muted/50 hover:text-curtn-cream cursor-pointer"
      >
        This is me
      </button>

      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
          onClick={(e) => { if (e.target === e.currentTarget) { setShowModal(false); setMessage(""); setError(null); } }}
        >
          <div className="w-full max-w-sm border border-curtn-dark bg-curtn-surface p-5 space-y-4 mx-4">
            <div>
              <p className="text-sm text-curtn-cream font-medium">Claim this profile</p>
              <p className="text-xs text-curtn-muted mt-1">
                Your request will be reviewed by an admin.
              </p>
            </div>

            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Link a social profile, portfolio, or anything that helps us verify (optional)"
              rows={3}
              className="w-full border border-curtn-dark bg-curtn-deep px-3 py-2 text-xs text-curtn-cream placeholder:text-curtn-muted/40 focus:border-curtn-coral focus:outline-none resize-none"
              autoFocus
            />

            {error && <p className="text-xs text-curtn-red">{error}</p>}

            <div className="flex gap-3 justify-end">
              <button
                type="button"
                onClick={() => { setShowModal(false); setMessage(""); setError(null); }}
                className="px-3 py-1.5 text-xs text-curtn-muted hover:text-curtn-cream transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={fetching}
                className="border border-curtn-coral bg-curtn-coral/10 px-4 py-1.5 text-xs font-medium text-curtn-coral transition-colors hover:bg-curtn-coral/20 cursor-pointer disabled:opacity-50"
              >
                {fetching ? "Submitting..." : "Submit request"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
