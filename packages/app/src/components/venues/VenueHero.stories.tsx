import type { Meta, StoryObj } from "@storybook/react";
import { VenueHero } from "./VenueHero";

const meta: Meta<typeof VenueHero> = {
  title: "Organisms/VenueHero",
  component: VenueHero,
  parameters: { layout: "padded" },
};

export default meta;
type Story = StoryObj<typeof VenueHero>;

export const FullVenue: Story = {
  args: {
    name: "Richard Rodgers Theatre",
    venueType: "theater",
    address: "226 W 46th St",
    city: "New York",
    state: "NY",
    zipCode: "10036",
    capacity: 1400,
    description:
      "Opened in 1924 as Chanin's 46th Street Theatre, the Richard Rodgers Theatre has hosted some of Broadway's most celebrated productions including Guys and Dolls, How to Succeed in Business Without Really Trying, Raisin, Nine, Damn Yankees, Chicago, Jersey Boys, and the Pulitzer Prize-winning Hamilton.",
    website: "https://example.com",
    phone: "+1 (212) 221-1211",
    email: "info@example.com",
    imageUrl: "https://picsum.photos/seed/venue-hero-rr/1400/500",
  },
};

export const NoImage: Story = {
  args: {
    name: "La MaMa Experimental Theatre Club",
    venueType: "theater",
    address: "74A E 4th St",
    city: "New York",
    state: "NY",
    zipCode: "10003",
    capacity: 99,
    description: "Founded in 1961, La MaMa has been dedicated to the playwright and all aspects of the theater.",
    website: "https://example.com",
    phone: null,
    email: null,
  },
};

export const PermanentlyClosed: Story = {
  args: {
    name: "CBGB",
    venueType: "other",
    address: "315 Bowery",
    city: "New York",
    state: "NY",
    zipCode: "10003",
    capacity: 330,
    description: "The Bowery club that birthed American punk rock.",
    website: null,
    phone: null,
    email: null,
    imageUrl: "https://picsum.photos/seed/venue-hero-cbgb/1400/500",
    permanentlyClosed: true,
    closedDate: "2006-10-15",
  },
};

export const NoContact: Story = {
  args: {
    name: "Brooklyn Bandshell",
    venueType: "outdoor",
    address: "Prospect Park",
    city: "Brooklyn",
    state: "NY",
    zipCode: null,
    capacity: null,
    description: null,
    website: null,
    phone: null,
    email: null,
  },
};
