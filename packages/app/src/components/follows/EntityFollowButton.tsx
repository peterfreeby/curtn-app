"use client";

import { useState } from "react";
import { useMutation } from "urql";
import { Button } from "@/components/Button";
import { ENTITY_FOLLOW_TOGGLE_MUTATION } from "@/lib/graphql/follows";
import { useAuth } from "@/lib/auth/useAuth";

type EntityFollowTargetType = "venue" | "person" | "productionCompany";

interface EntityFollowButtonProps {
  /** Global (relay) ID of the entity */
  targetId: string;
  targetType: EntityFollowTargetType;
  /** Initial follow state from the entity query */
  isFollowedByViewer?: boolean;
  size?: "sm" | "md" | "lg";
  className?: string;
}

export function EntityFollowButton({
  targetId,
  targetType,
  isFollowedByViewer,
  size = "md",
  className,
}: EntityFollowButtonProps) {
  const { user } = useAuth();
  const [{ fetching }, executeToggle] = useMutation(ENTITY_FOLLOW_TOGGLE_MUTATION);
  const [optimistic, setOptimistic] = useState<boolean | null>(null);

  // Hide for signed-out viewers (matches user-follow behavior)
  if (!user) return null;

  const isFollowing = optimistic ?? isFollowedByViewer ?? false;

  async function handleToggle() {
    const wasFollowing = isFollowing;
    setOptimistic(!wasFollowing);

    const result = await executeToggle({ input: { targetType, targetId } });

    if (result.error || result.data?.entityFollowToggle?.error) {
      setOptimistic(wasFollowing);
    }
  }

  return (
    <Button
      variant={isFollowing ? "secondary" : "primary"}
      size={size}
      onClick={handleToggle}
      disabled={fetching}
      className={className}
    >
      {isFollowing ? "Following" : "Follow"}
    </Button>
  );
}
