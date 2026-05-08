import type { Meta, StoryObj } from "@storybook/react";
import { ReviewsList } from "./ReviewsList";

const meta: Meta<typeof ReviewsList> = {
  title: "Organisms/ReviewsList",
  component: ReviewsList,
  decorators: [(Story) => <div className="max-w-xl"><Story /></div>],
};

export default meta;
type Story = StoryObj<typeof ReviewsList>;

const makeReview = (i: number, overrides: Record<string, unknown> = {}) => ({
  id: `review-${i}`,
  rating: 4 + (i % 2) * 0.5,
  text:
    i % 3 === 0
      ? null
      : `Review number ${i}. The production is tight, the performances are electric, and the staging does things I didn't know were possible.`,
  attendedAt: "2026-03-12",
  createdAt: `2026-04-${10 + i}T00:00:00Z`,
  venue: "Richard Rodgers Theatre",
  isFollowedByViewer: i === 0,
  user: {
    id: `u-${i}`,
    username: ["sarahk", "marcust", "lenar", "peter", "dani", "avery"][i % 6],
    fullName: ["Sarah Kim", "Marcus Torres", "Lena Rivera", "Peter Freeby", "Dani Wu", "Avery Lee"][i % 6],
    avatarUrl: null,
  },
  ...overrides,
});

export const Populated: Story = {
  parameters: {
    urqlMockData: {
      RunReviews: {
        reviewList: {
          edges: Array.from({ length: 4 }).map((_, i) => ({
            cursor: `c-${i}`,
            node: makeReview(i),
          })),
          pageInfo: { hasNextPage: false, endCursor: null },
        },
      },
    },
  },
  args: { runId: "run-1" },
};

export const WithMoreAvailable: Story = {
  parameters: {
    urqlMockData: {
      RunReviews: {
        reviewList: {
          edges: Array.from({ length: 6 }).map((_, i) => ({
            cursor: `c-${i}`,
            node: makeReview(i),
          })),
          pageInfo: { hasNextPage: true, endCursor: "c-5" },
        },
      },
    },
  },
  args: { runId: "run-1" },
};

export const Empty: Story = {
  parameters: {
    urqlMockData: {
      RunReviews: {
        reviewList: {
          edges: [],
          pageInfo: { hasNextPage: false, endCursor: null },
        },
      },
    },
  },
  args: { runId: "run-empty" },
};
