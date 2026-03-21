"use client";

import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { Avatar } from "@/components/Avatar";

interface ProfileHeaderProps {
  fullName: string;
  username: string;
  bio?: string;
  avatarUrl?: string;
  reviewCount: number;
  followerCount: number;
  followingCount: number;
  isOwnProfile: boolean;
  isFollowing?: boolean;
  onFollowToggle?: () => void;
  followLoading?: boolean;
  isAuthenticated?: boolean;
  onEditProfile?: () => void;
}

export function ProfileHeader({
  fullName,
  username,
  bio,
  avatarUrl,
  reviewCount,
  followerCount,
  followingCount,
  isOwnProfile,
  isFollowing,
  onFollowToggle,
  followLoading,
  isAuthenticated,
  onEditProfile,
}: ProfileHeaderProps) {
  return (
    <Card className="flex items-center gap-5">
      <Avatar src={avatarUrl} name={fullName} size="lg" />
      <div className="min-w-0 flex-1">
        <h1 className="text-xl font-bold text-curtn-cream truncate">
          {fullName}
        </h1>
        <p className="text-sm text-curtn-muted">@{username}</p>
        {bio && (
          <p className="mt-1 text-sm text-curtn-cream/80 line-clamp-2">
            {bio}
          </p>
        )}
        <p className="mt-1 text-xs text-curtn-muted/70">
          {reviewCount} {reviewCount === 1 ? "review" : "reviews"}
          {" · "}
          {followerCount} {followerCount === 1 ? "follower" : "followers"}
          {" · "}
          {followingCount} following
        </p>
      </div>
      {isOwnProfile ? (
        <button
          type="button"
          onClick={onEditProfile}
          className="shrink-0 border border-curtn-dark px-4 py-2 text-sm text-curtn-muted transition-colors hover:border-curtn-muted/50 hover:text-curtn-cream cursor-pointer"
        >
          Edit Profile
        </button>
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
