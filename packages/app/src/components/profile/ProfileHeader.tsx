"use client";

import Link from "next/link";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";

interface ProfileHeaderProps {
  fullName: string;
  username: string;
  reviewCount: number;
  followerCount: number;
  followingCount: number;
  isOwnProfile: boolean;
  isFollowing?: boolean;
  onFollowToggle?: () => void;
  followLoading?: boolean;
  isAuthenticated?: boolean;
}

export function ProfileHeader({
  fullName,
  username,
  reviewCount,
  followerCount,
  followingCount,
  isOwnProfile,
  isFollowing,
  onFollowToggle,
  followLoading,
  isAuthenticated,
}: ProfileHeaderProps) {
  const initial = fullName.charAt(0).toUpperCase();

  return (
    <Card className="flex items-center gap-5">
      <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-curtn-coral text-curtn-deep text-2xl font-bold select-none">
        {initial}
      </div>
      <div className="min-w-0 flex-1">
        <h1 className="text-xl font-bold text-curtn-cream truncate">
          {fullName}
        </h1>
        <p className="text-sm text-curtn-muted">@{username}</p>
        <p className="mt-1 text-xs text-curtn-muted/70">
          {reviewCount} {reviewCount === 1 ? "review" : "reviews"}
          {" · "}
          {followerCount} {followerCount === 1 ? "follower" : "followers"}
          {" · "}
          {followingCount} following
        </p>
      </div>
      {isOwnProfile ? (
        <Link
          href="/settings"
          className="shrink-0 rounded-lg border border-curtn-dark px-4 py-2 text-sm text-curtn-muted transition-colors hover:border-curtn-muted/50 hover:text-curtn-cream"
        >
          Edit Profile
        </Link>
      ) : isAuthenticated ? (
        <Button
          variant={isFollowing ? "secondary" : "primary"}
          onClick={onFollowToggle}
          disabled={followLoading}
          className="shrink-0 !px-4 !py-2"
        >
          {isFollowing ? "Following" : "Follow"}
        </Button>
      ) : null}
    </Card>
  );
}
