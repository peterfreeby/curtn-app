import type { Meta, StoryObj } from "@storybook/react";
import { WatchlistButton } from "./WatchlistButton";

const meta: Meta<typeof WatchlistButton> = {
  title: "Molecules/WatchlistButton",
  component: WatchlistButton,
};

export default meta;
type Story = StoryObj<typeof WatchlistButton>;

export const NotOnWatchlist: Story = {
  args: {
    showId: "show-1",
    initialIsOnWatchlist: false,
    initialWatchlistCount: 124,
  },
};

export const OnWatchlist: Story = {
  args: {
    showId: "show-1",
    initialIsOnWatchlist: true,
    initialWatchlistCount: 125,
  },
};

export const NoCount: Story = {
  args: {
    showId: "show-2",
    initialIsOnWatchlist: false,
    initialWatchlistCount: 0,
  },
};

export const SignedOut: Story = {
  parameters: { auth: "signed-out" },
  args: {
    showId: "show-1",
    initialIsOnWatchlist: false,
    initialWatchlistCount: 10,
  },
};
