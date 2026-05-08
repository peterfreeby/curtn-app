import type { Meta, StoryObj } from "@storybook/react";
import { ProfileHeader } from "./ProfileHeader";

const meta: Meta<typeof ProfileHeader> = {
  title: "Organisms/Profile/ProfileHeader",
  component: ProfileHeader,
  decorators: [(Story) => <div className="max-w-2xl"><Story /></div>],
};

export default meta;
type Story = StoryObj<typeof ProfileHeader>;

export const OwnProfile: Story = {
  args: {
    fullName: "Sarah Kim",
    username: "sarahk",
    bio: "Theater critic, arts writer, Brooklyn-based. I log what I see so I remember what I thought.",
    avatarUrl: "https://i.pravatar.cc/100?img=3",
    reviewCount: 128,
    followerCount: 42,
    followingCount: 88,
    isOwnProfile: true,
    onEditProfile: () => alert("Edit"),
  },
};

export const OtherUserFollowable: Story = {
  args: {
    fullName: "Marcus Torres",
    username: "marcust",
    bio: "Always watching.",
    avatarUrl: "https://i.pravatar.cc/100?img=12",
    reviewCount: 14,
    followerCount: 5,
    followingCount: 23,
    isOwnProfile: false,
    isAuthenticated: true,
    isFollowing: false,
    onFollowToggle: () => alert("Follow"),
  },
};

export const OtherUserFollowing: Story = {
  args: {
    fullName: "Marcus Torres",
    username: "marcust",
    bio: "Always watching.",
    avatarUrl: "https://i.pravatar.cc/100?img=12",
    reviewCount: 14,
    followerCount: 5,
    followingCount: 23,
    isOwnProfile: false,
    isAuthenticated: true,
    isFollowing: true,
    onFollowToggle: () => alert("Unfollow"),
  },
};

export const SignedOutViewer: Story = {
  args: {
    fullName: "Lena Rivera",
    username: "lenar",
    reviewCount: 1,
    followerCount: 0,
    followingCount: 0,
    isOwnProfile: false,
    isAuthenticated: false,
  },
};

export const NoBio: Story = {
  args: {
    fullName: "Peter Freeby",
    username: "peter",
    reviewCount: 0,
    followerCount: 0,
    followingCount: 0,
    isOwnProfile: true,
    onEditProfile: () => alert("Edit"),
  },
};
