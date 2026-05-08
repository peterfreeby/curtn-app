import type { Meta, StoryObj } from "@storybook/react";
import { PerformanceMap } from "./PerformanceMap";

const meta: Meta<typeof PerformanceMap> = {
  title: "Organisms/Maps/PerformanceMap",
  component: PerformanceMap,
  parameters: { layout: "fullscreen" },
  decorators: [(Story) => <div className="w-full h-[600px] bg-curtn-deep"><Story /></div>],
};

export default meta;
type Story = StoryObj<typeof PerformanceMap>;

const nycVenues = [
  { id: "v1", name: "Richard Rodgers Theatre", slug: "richard-rodgers-theatre", city: "New York", coordinates: { lat: 40.7598, lng: -73.9855 } },
  { id: "v2", name: "Hudson Theatre", slug: "hudson-theatre", city: "New York", coordinates: { lat: 40.7579, lng: -73.9845 } },
  { id: "v3", name: "Carnegie Hall", slug: "carnegie-hall", city: "New York", coordinates: { lat: 40.765, lng: -73.9799 } },
  { id: "v4", name: "Brooklyn Academy of Music", slug: "bam", city: "Brooklyn", coordinates: { lat: 40.6866, lng: -73.9781 } },
];

const performances = nycVenues.flatMap((venue, vi) =>
  Array.from({ length: 2 }).map((_, i) => ({
    id: `perf-${vi}-${i}`,
    date: "2026-04-15",
    time: "19:00",
    venue,
    ticketUrl: "https://example.com/tickets",
    soldOut: i === 1,
    run: {
      id: `run-${vi}-${i}`,
      show: {
        id: `show-${vi}-${i}`,
        title: ["Hamilton", "Macbeth", "Cabaret", "Sweeney Todd"][vi],
        posterUrl: `https://picsum.photos/seed/map-${vi}-${i}/100/150`,
        performanceTypes: ["Musical"],
      },
      productionCompany: { name: "The Public Theater" },
    },
  }))
);

export const ManueyVenues: Story = {
  args: { performances },
};

export const SingleVenue: Story = {
  args: { performances: performances.slice(0, 1) },
};

export const Empty: Story = {
  args: { performances: [] },
};
