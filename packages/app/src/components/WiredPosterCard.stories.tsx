import type { Meta, StoryObj } from "@storybook/react";
import { WiredPosterCard } from "./WiredPosterCard";

const meta: Meta<typeof WiredPosterCard> = {
  title: "Molecules/WiredPosterCard",
  component: WiredPosterCard,
  argTypes: {
    size: { control: "select", options: ["sm", "md", "lg"] },
  },
};

export default meta;
type Story = StoryObj<typeof WiredPosterCard>;

const POSTER = "https://picsum.photos/seed/wired-hamilton/300/475";

export const SingleRun: Story = {
  args: {
    showId: "show-1",
    imageUrl: POSTER,
    title: "Hamilton",
    subtitle: "Richard Rodgers Theatre",
    runId: "run-1",
    isOnWatchlist: false,
    ticketUrl: "https://example.com/tickets",
    size: "md",
  },
};

export const OnWatchlist: Story = {
  args: {
    showId: "show-1",
    imageUrl: POSTER,
    title: "Hamilton",
    subtitle: "Richard Rodgers Theatre",
    runId: "run-1",
    isOnWatchlist: true,
    ticketUrl: "https://example.com/tickets",
    size: "md",
  },
};

export const MultipleRuns: Story = {
  args: {
    showId: "show-1",
    imageUrl: POSTER,
    title: "Hamilton",
    subtitle: "Active productions",
    runs: [
      { id: "run-1", label: "Broadway · 2015–present" },
      { id: "run-2", label: "West End · 2017–2023" },
      { id: "run-3", label: "Chicago Tour · 2016–2020" },
    ],
    size: "md",
  },
};

export const NoRun: Story = {
  args: {
    showId: "show-2",
    imageUrl: "https://picsum.photos/seed/wired-noread/300/475",
    title: "Work-in-Progress",
    subtitle: "Upcoming",
    size: "md",
  },
};

export const SignedOut: Story = {
  parameters: { auth: "signed-out" },
  args: {
    showId: "show-1",
    imageUrl: POSTER,
    title: "Hamilton",
    subtitle: "Sign in to log",
    runId: "run-1",
    size: "md",
  },
};
