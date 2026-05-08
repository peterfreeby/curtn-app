import type { Meta, StoryObj } from "@storybook/react";
import { RunCard } from "./RunCard";

const meta: Meta<typeof RunCard> = {
  title: "Molecules/RunCard",
  component: RunCard,
  decorators: [(Story) => <div className="max-w-md"><Story /></div>],
};

export default meta;
type Story = StoryObj<typeof RunCard>;

export const Default: Story = {
  args: {
    id: "r1",
    showTitle: "Hamilton",
    performanceTypes: ["Musical"],
    companyName: "Public Theater",
    venueName: "Richard Rodgers Theatre",
    venueCity: "New York",
    startDate: "2026-04-01",
    endDate: "2026-07-30",
    averageRating: 4.7,
    reviewCount: 186,
    imageUrl: "https://picsum.photos/seed/run-hamilton/200/300",
  },
};

export const SinglePerformance: Story = {
  args: {
    id: "r2",
    showTitle: "A Streetcar Named Desire",
    performanceTypes: ["Drama"],
    companyName: "Signature Theatre",
    venueName: "Brooklyn Academy of Music",
    venueCity: "Brooklyn",
    startDate: "2026-05-15",
    endDate: "2026-05-15",
    averageRating: 4.4,
    reviewCount: 22,
  },
};

export const NoPoster: Story = {
  args: {
    id: "r3",
    showTitle: "Waiting for Godot",
    performanceTypes: ["Drama"],
    companyName: "Theatre for a New Audience",
    venueName: "Polonsky Shakespeare Center",
    venueCity: "Brooklyn",
    startDate: "2026-06-01",
    endDate: "2026-06-25",
    averageRating: null,
    reviewCount: 0,
  },
};

export const NoDates: Story = {
  args: {
    id: "r4",
    showTitle: "Macbeth",
    performanceTypes: ["Drama"],
    companyName: "Royal Shakespeare Company",
    averageRating: 4.2,
    reviewCount: 54,
  },
};
