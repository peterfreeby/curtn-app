import type { Meta, StoryObj } from "@storybook/react";
import { VenuePerformances } from "./VenuePerformances";

const meta: Meta<typeof VenuePerformances> = {
  title: "Organisms/VenuePerformances",
  component: VenuePerformances,
  decorators: [(Story) => <div className="max-w-xl"><Story /></div>],
};

export default meta;
type Story = StoryObj<typeof VenuePerformances>;

const mkRun = (id: string, title: string, start: string, end: string, rating: number | null, reviews: number) => ({
  id,
  show: {
    id: `show-${id}`,
    title,
    performanceTypes: ["Musical"],
    posterUrl: `https://picsum.photos/seed/vp-${id}/120/180`,
    imageUrl: null,
  },
  productionCompany: { name: "The Public Theater", slug: "the-public-theater" },
  startDate: start,
  endDate: end,
  averageRating: rating,
  reviewCount: reviews,
});

export const Populated: Story = {
  args: { venueName: "Richard Rodgers Theatre" },
  parameters: {
    urqlMockData: {
      VenueRuns: {
        runsByVenue: {
          edges: [
            { node: mkRun("1", "Hamilton", "2015-08-06", "2016-07-09", 4.9, 340) },
            { node: mkRun("2", "Guys and Dolls", "2009-03-01", "2010-06-14", 4.3, 120) },
            { node: mkRun("3", "In the Heights", "2008-03-09", "2011-01-09", 4.6, 220) },
          ],
          pageInfo: { hasNextPage: false, endCursor: null },
        },
      },
    },
  },
};

export const HasMore: Story = {
  args: { venueName: "Richard Rodgers Theatre" },
  parameters: {
    urqlMockData: {
      VenueRuns: {
        runsByVenue: {
          edges: Array.from({ length: 6 }).map((_, i) => ({
            node: mkRun(String(i), `Run ${i}`, "2020-01-01", "2020-12-31", 4.0, 30),
          })),
          pageInfo: { hasNextPage: true, endCursor: "c6" },
        },
      },
    },
  },
};

export const Empty: Story = {
  args: { venueName: "No Runs Venue" },
  parameters: {
    urqlMockData: {
      VenueRuns: {
        runsByVenue: {
          edges: [],
          pageInfo: { hasNextPage: false, endCursor: null },
        },
      },
    },
  },
};
