import type { Meta, StoryObj } from "@storybook/react";
import { ShowGrid } from "./ShowGrid";

const meta: Meta<typeof ShowGrid> = {
  title: "Organisms/ShowGrid",
  component: ShowGrid,
  parameters: { layout: "padded" },
};

export default meta;
type Story = StoryObj<typeof ShowGrid>;

const TITLES = [
  "Hamilton",
  "Death of a Salesman",
  "The Book of Mormon",
  "Waiting for Godot",
  "Macbeth",
  "Our Town",
  "A Streetcar Named Desire",
  "Sweeney Todd",
  "Cabaret",
  "King Lear",
  "The Crucible",
  "West Side Story",
];

const shows = TITLES.map((title, i) => ({
  id: `show-${i}`,
  title,
  performanceTypes: ["Musical"],
  posterUrl: `https://picsum.photos/seed/sg-${i}/300/475`,
  averageRating: 3.5 + (i % 4) * 0.3,
  reviewCount: 20 + i * 7,
  isOnMyWatchlist: i % 4 === 0,
  runs: {
    edges: [
      {
        node: {
          id: `run-${i}`,
          productionCompany: { name: "The Public Theater", slug: "the-public-theater" },
          venues: [{ name: "Richard Rodgers Theatre", city: "New York" }],
          startDate: "2026-04-01",
          endDate: "2026-07-30",
        },
      },
    ],
  },
}));

export const Populated: Story = {
  args: { shows, loading: false },
};

export const Loading: Story = {
  args: { shows: [], loading: true },
};

export const Empty: Story = {
  args: { shows: [], loading: false },
};
