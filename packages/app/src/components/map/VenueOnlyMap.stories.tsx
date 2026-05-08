import type { Meta, StoryObj } from "@storybook/react";
import { VenueOnlyMap } from "./VenueOnlyMap";

const meta: Meta<typeof VenueOnlyMap> = {
  title: "Organisms/Maps/VenueOnlyMap",
  component: VenueOnlyMap,
  parameters: { layout: "fullscreen" },
  decorators: [(Story) => <div className="w-full h-[600px] bg-curtn-deep"><Story /></div>],
};

export default meta;
type Story = StoryObj<typeof VenueOnlyMap>;

const venues = [
  { id: "v1", name: "Richard Rodgers Theatre", slug: "richard-rodgers-theatre", city: "New York", coordinates: { lat: 40.7598, lng: -73.9855 } },
  { id: "v2", name: "Hudson Theatre", slug: "hudson-theatre", city: "New York", coordinates: { lat: 40.7579, lng: -73.9845 } },
  { id: "v3", name: "Carnegie Hall", slug: "carnegie-hall", city: "New York", coordinates: { lat: 40.765, lng: -73.9799 } },
  { id: "v4", name: "BAM", slug: "bam", city: "Brooklyn", coordinates: { lat: 40.6866, lng: -73.9781 } },
  { id: "v5", name: "La MaMa", slug: "la-mama", city: "New York", coordinates: { lat: 40.7265, lng: -73.9888 } },
  { id: "v6", name: "The Public Theater", slug: "the-public-theater", city: "New York", coordinates: { lat: 40.729, lng: -73.9905 } },
];

export const ManyVenues: Story = {
  args: { venues },
};

export const SingleVenue: Story = {
  args: { venues: venues.slice(0, 1) },
};

export const Empty: Story = {
  args: { venues: [] },
};
