import type { Meta, StoryObj } from "@storybook/react";
import { StarRating } from "./StarRating";

const meta: Meta<typeof StarRating> = {
  title: "Core/StarRating",
  component: StarRating,
  argTypes: {
    value: { control: { type: "range", min: 0, max: 5, step: 0.5 } },
    size: { control: { type: "number", min: 10, max: 32 } },
    readOnly: { control: "boolean" },
  },
};

export default meta;
type Story = StoryObj<typeof StarRating>;

export const Default: Story = {
  args: { value: 3.5, size: 16, readOnly: true },
};

export const Empty: Story = {
  args: { value: 0, size: 16, readOnly: true },
};

export const Full: Story = {
  args: { value: 5, size: 16, readOnly: true },
};

export const AllRatings: Story = {
  render: () => (
    <div className="space-y-2">
      {[0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5].map((v) => (
        <div key={v} className="flex items-center gap-3">
          <span className="text-xs text-curtn-muted w-6">{v}</span>
          <StarRating value={v} size={16} readOnly />
        </div>
      ))}
    </div>
  ),
};
