import type { Meta, StoryObj } from "@storybook/react";
import { Card } from "./Card";

const meta: Meta<typeof Card> = {
  title: "Core/Card",
  component: Card,
};

export default meta;
type Story = StoryObj<typeof Card>;

export const Default: Story = {
  args: {
    children: (
      <div className="space-y-2">
        <h3 className="text-sm font-medium text-curtn-cream">Card Title</h3>
        <p className="text-xs text-curtn-muted">Card content goes here.</p>
      </div>
    ),
  },
};
