import type { Meta, StoryObj } from "@storybook/react";
import { Toast } from "./Toast";

const meta: Meta<typeof Toast> = {
  title: "Atoms/Toast",
  component: Toast,
  argTypes: {
    duration: { control: { type: "number", min: 1000, max: 60000, step: 1000 } },
  },
  parameters: {
    layout: "fullscreen",
  },
};

export default meta;
type Story = StoryObj<typeof Toast>;

export const Default: Story = {
  args: { message: "Review saved", duration: 60000 },
};

export const WithAction: Story = {
  args: {
    message: "Added to watchlist",
    actionLabel: "View list",
    actionHref: "/watchlist",
    duration: 60000,
  },
};

export const LongMessage: Story = {
  args: {
    message: "Your review was posted to Hamilton at the Richard Rodgers Theatre",
    actionLabel: "See it",
    actionHref: "/runs/1",
    duration: 60000,
  },
};
