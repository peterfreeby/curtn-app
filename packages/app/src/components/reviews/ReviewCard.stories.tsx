import type { Meta, StoryObj } from "@storybook/react";
import { ReviewCard } from "./ReviewCard";

const meta: Meta<typeof ReviewCard> = {
  title: "Reviews/ReviewCard",
  component: ReviewCard,
  decorators: [(Story) => <div className="max-w-lg"><Story /></div>],
};

export default meta;
type Story = StoryObj<typeof ReviewCard>;

const baseReview = {
  id: "1",
  rating: 4,
  text: "The staging is so tight that even with a completely new cast, every moment lands exactly where it should. Standing ovation.",
  createdAt: "2026-03-15T00:00:00.000Z",
  user: { id: "u1", username: "sarahk", fullName: "Sarah Kim", avatarUrl: null },
};

export const Default: Story = {
  args: {
    review: baseReview,
  },
};

export const FollowedUser: Story = {
  args: {
    review: { ...baseReview, isFollowedByViewer: true },
  },
};

export const WithPoster: Story = {
  args: {
    review: {
      ...baseReview,
      run: {
        id: "r1",
        show: { id: "s1", title: "Hamilton", posterUrl: null, imageUrl: null },
      },
    },
    showPerformanceLink: true,
  },
};

export const RatingOnly: Story = {
  args: {
    review: { ...baseReview, text: null, rating: 3.5 },
  },
};

export const FiveStarRave: Story = {
  args: {
    review: {
      ...baseReview,
      rating: 5,
      text: "I have never experienced anything like this in my entire life. I am changed forever. Everyone needs to see this show.",
      isFollowedByViewer: true,
    },
  },
};
