import type { Meta, StoryObj } from "@storybook/react";
import { VenueGrid } from "./VenueGrid";

const meta: Meta<typeof VenueGrid> = {
  title: "Organisms/VenueGrid",
  component: VenueGrid,
  parameters: { layout: "padded" },
};

export default meta;
type Story = StoryObj<typeof VenueGrid>;

const venues = [
  {
    id: "v1",
    name: "Richard Rodgers Theatre",
    slug: "richard-rodgers-theatre",
    address: "226 W 46th St",
    city: "New York",
    state: "NY",
    capacity: 1400,
    venueType: "theater",
    imageUrl: "https://picsum.photos/seed/vg-rr/600/338",
  },
  {
    id: "v2",
    name: "Carnegie Hall",
    slug: "carnegie-hall",
    address: "881 7th Ave",
    city: "New York",
    state: "NY",
    capacity: 2804,
    venueType: "concert-hall",
    imageUrl: "https://picsum.photos/seed/vg-carnegie/600/338",
  },
  {
    id: "v3",
    name: "La MaMa",
    slug: "la-mama",
    address: "74A E 4th St",
    city: "New York",
    state: "NY",
    capacity: 99,
    venueType: "theater",
  },
  {
    id: "v4",
    name: "Brooklyn Bandshell",
    slug: "brooklyn-bandshell",
    address: "Prospect Park",
    city: "Brooklyn",
    state: "NY",
    capacity: null,
    venueType: "outdoor",
  },
  {
    id: "v5",
    name: "CBGB",
    slug: "cbgb",
    address: "315 Bowery",
    city: "New York",
    state: "NY",
    capacity: 330,
    venueType: "other",
    permanentlyClosed: true,
    imageUrl: "https://picsum.photos/seed/vg-cbgb/600/338",
  },
  {
    id: "v6",
    name: "Public Theater",
    slug: "public-theater",
    address: "425 Lafayette St",
    city: "New York",
    state: "NY",
    capacity: 299,
    venueType: "theater",
    imageUrl: "https://picsum.photos/seed/vg-public/600/338",
  },
];

export const Populated: Story = {
  args: { venues, loading: false },
};

export const Loading: Story = {
  args: { venues: [], loading: true },
};

export const Empty: Story = {
  args: { venues: [], loading: false },
};
