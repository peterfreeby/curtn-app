import type { Meta, StoryObj } from "@storybook/react";
import { ReviewCard } from "./ReviewCard";

const meta: Meta<typeof ReviewCard> = {
  title: "Organisms/ReviewCard",
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
  args: { review: baseReview },
};

export const FollowedUser: Story = {
  args: { review: { ...baseReview, isFollowedByViewer: true } },
};

export const WithShowLink: Story = {
  args: {
    review: {
      ...baseReview,
      run: { id: "r1", show: { id: "s1", title: "Hamilton", posterUrl: null, imageUrl: null } },
    },
    showPerformanceLink: true,
  },
};

export const RatingOnly: Story = {
  args: { review: { ...baseReview, text: null, rating: 3.5 } },
};

export const LongReview: Story = {
  args: {
    review: {
      ...baseReview,
      rating: 5,
      isFollowedByViewer: true,
      text: "I have never experienced anything like this in my entire life. The way the turntable staging works with the choreography creates this kinetic energy that just builds and builds. By the time we got to Yorktown I was gripping the armrest. And then the second act completely recontextualizes everything from the first — it's not just a biography, it's a meditation on legacy and who gets to tell whose story. I'm going to be thinking about this for weeks.",
    },
  },
};

export const MultipleReviews: Story = {
  render: () => (
    <div>
      <ReviewCard review={{ ...baseReview, isFollowedByViewer: true }} />
      <ReviewCard review={{ ...baseReview, id: "2", rating: 3, text: "Good but overhyped. The music is great, staging is great, but I went in expecting a life-changing experience and it was just a really good show.", user: { id: "u2", username: "marcust", fullName: "Marcus Torres", avatarUrl: null } }} />
      <ReviewCard review={{ ...baseReview, id: "3", rating: 5, text: null, user: { id: "u3", username: "lenar", fullName: "Lena Rivera", avatarUrl: null } }} />
    </div>
  ),
};
