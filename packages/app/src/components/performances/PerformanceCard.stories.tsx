import type { Meta, StoryObj } from "@storybook/react";
import { PerformanceCard } from "./PerformanceCard";

const meta: Meta<typeof PerformanceCard> = {
  title: "Molecules/PerformanceCard",
  component: PerformanceCard,
  decorators: [(Story) => <div className="max-w-xs"><Story /></div>],
};

export default meta;
type Story = StoryObj<typeof PerformanceCard>;

export const Default: Story = {
  args: {
    id: "p1",
    title: "Hamilton",
    performanceTypes: ["Musical"],
    companyName: "The Public Theater",
    averageRating: 4.6,
    reviewCount: 128,
    upcomingCount: 3,
    imageUrl: "https://picsum.photos/seed/perf-default/450/300",
  },
};

export const NoImage: Story = {
  args: {
    id: "p2",
    title: "Death of a Salesman",
    performanceTypes: ["Drama"],
    companyName: "Roundabout Theatre Company",
    averageRating: 4.2,
    reviewCount: 42,
    upcomingCount: 0,
  },
};

export const MultipleTypes: Story = {
  args: {
    id: "p3",
    title: "The Book of Mormon",
    performanceTypes: ["Musical", "Comedy"],
    companyName: "Casey Nicholaw",
    averageRating: 4.8,
    reviewCount: 512,
    upcomingCount: 12,
    imageUrl: "https://picsum.photos/seed/perf-mormon/450/300",
  },
};

export const NoRatings: Story = {
  args: {
    id: "p4",
    title: "New Off-Broadway Premiere",
    performanceTypes: ["Drama"],
    companyName: "New Ohio Theatre",
    averageRating: null,
    reviewCount: 0,
    upcomingCount: 1,
  },
};

export const LongTitle: Story = {
  args: {
    id: "p5",
    title: "The Strange Undoing of Prudencia Hart by David Greig",
    performanceTypes: ["Drama", "Musical"],
    companyName: "National Theatre of Scotland",
    averageRating: 4.5,
    reviewCount: 33,
    upcomingCount: 0,
  },
};
