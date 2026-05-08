import type { Meta, StoryObj } from "@storybook/react";
import { VenueCard } from "./VenueCard";

const meta: Meta<typeof VenueCard> = {
  title: "Molecules/VenueCard",
  component: VenueCard,
  decorators: [(Story) => <div className="max-w-sm"><Story /></div>],
};

export default meta;
type Story = StoryObj<typeof VenueCard>;

export const Default: Story = {
  args: {
    slug: "richard-rodgers-theatre",
    name: "Richard Rodgers Theatre",
    venueType: "theater",
    address: "226 W 46th St",
    city: "New York",
    state: "NY",
    capacity: 1400,
    imageUrl: "https://picsum.photos/seed/venue-richardrodgers/600/338",
  },
};

export const ConcertHall: Story = {
  args: {
    slug: "carnegie-hall",
    name: "Carnegie Hall",
    venueType: "concert-hall",
    address: "881 7th Ave",
    city: "New York",
    state: "NY",
    capacity: 2804,
    imageUrl: "https://picsum.photos/seed/venue-carnegie/600/338",
  },
};

export const NoImage: Story = {
  args: {
    slug: "la-mama",
    name: "La MaMa Experimental Theatre Club",
    venueType: "theater",
    address: "74A E 4th St",
    city: "New York",
    state: "NY",
    capacity: 99,
  },
};

export const PermanentlyClosed: Story = {
  args: {
    slug: "cbgb",
    name: "CBGB",
    venueType: "other",
    address: "315 Bowery",
    city: "New York",
    state: "NY",
    capacity: 330,
    imageUrl: "https://picsum.photos/seed/venue-cbgb/600/338",
    permanentlyClosed: true,
  },
};

export const NoCapacity: Story = {
  args: {
    slug: "brooklyn-park",
    name: "Brooklyn Bandshell",
    venueType: "outdoor",
    address: "Prospect Park",
    city: "Brooklyn",
    state: "NY",
    capacity: null,
  },
};
