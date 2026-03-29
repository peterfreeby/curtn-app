import type { Meta, StoryObj } from "@storybook/react";
import { Button } from "./Button";

const meta: Meta<typeof Button> = {
  title: "Core/Button",
  component: Button,
  argTypes: {
    variant: {
      control: "select",
      options: ["primary", "secondary", "ghost"],
    },
    fullWidth: { control: "boolean" },
    disabled: { control: "boolean" },
  },
};

export default meta;
type Story = StoryObj<typeof Button>;

export const Primary: Story = {
  args: { variant: "primary", children: "Log This Show" },
};

export const Secondary: Story = {
  args: { variant: "secondary", children: "Add to List" },
};

export const Ghost: Story = {
  args: { variant: "ghost", children: "Edit" },
};

export const FullWidth: Story = {
  args: { variant: "primary", children: "Log This Show", fullWidth: true },
};

export const Disabled: Story = {
  args: { variant: "primary", children: "Loading...", disabled: true },
};

export const AllVariants: Story = {
  render: () => (
    <div className="space-y-4 max-w-sm">
      <div className="space-y-2">
        <p className="text-xs text-curtn-muted uppercase tracking-wider">Primary</p>
        <Button variant="primary">Log This Show</Button>
      </div>
      <div className="space-y-2">
        <p className="text-xs text-curtn-muted uppercase tracking-wider">Secondary</p>
        <Button variant="secondary">Add to List</Button>
      </div>
      <div className="space-y-2">
        <p className="text-xs text-curtn-muted uppercase tracking-wider">Ghost</p>
        <Button variant="ghost">Edit</Button>
      </div>
    </div>
  ),
};
