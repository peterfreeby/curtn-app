import type { Meta, StoryObj } from "@storybook/react";
import { Button } from "./Button";

const meta: Meta<typeof Button> = {
  title: "Atoms/Button",
  component: Button,
  argTypes: {
    variant: { control: "select", options: ["primary", "secondary", "tertiary"] },
    size: { control: "select", options: ["sm", "md", "lg"] },
    fullWidth: { control: "boolean" },
    disabled: { control: "boolean" },
    icon: { control: "select", options: [undefined, "ticket", "heart", "pencil", "plus", "star", "globe", "copy"] },
    iconPosition: { control: "select", options: ["left", "right"] },
  },
};

export default meta;
type Story = StoryObj<typeof Button>;

// --- Individual variants ---

export const Primary: Story = {
  args: { variant: "primary", children: "Log This Show" },
};

export const Secondary: Story = {
  args: { variant: "secondary", children: "Add to List" },
};

export const Tertiary: Story = {
  args: { variant: "tertiary", children: "Edit" },
};

// --- Sizes ---

export const Small: Story = {
  args: { variant: "secondary", size: "sm", children: "Filter" },
};

export const Medium: Story = {
  args: { variant: "primary", size: "md", children: "Log This Show" },
};

export const Large: Story = {
  args: { variant: "primary", size: "lg", children: "Log This Show", fullWidth: true },
};

// --- With icons ---

export const PrimaryWithIcon: Story = {
  args: { variant: "primary", children: "Log This Show", icon: "plus" },
};

export const SecondaryWithIcon: Story = {
  args: { variant: "secondary", children: "Add to List", icon: "plus" },
};

export const TertiaryWithIcon: Story = {
  args: { variant: "tertiary", children: "Edit", icon: "pencil" },
};

export const IconRight: Story = {
  args: { variant: "secondary", children: "Tickets", icon: "ticket", iconPosition: "right" },
};

// --- As Link ---

export const PrimaryLink: Story = {
  args: { variant: "primary", children: "Log This Show", href: "/log", fullWidth: true, size: "lg" },
};

// --- Disabled ---

export const Disabled: Story = {
  args: { variant: "primary", children: "Loading...", disabled: true },
};

// --- Full System Overview ---

export const CTASystem: Story = {
  render: () => (
    <div className="space-y-8 max-w-md">
      <div className="space-y-3">
        <p className="text-[10px] text-curtn-muted uppercase tracking-widest">Primary CTAs</p>
        <p className="text-xs text-curtn-muted/60 mb-2">High-intent actions: logging, watchlisting</p>
        <div className="space-y-2">
          <Button variant="primary" size="lg" fullWidth>Log This Show</Button>
          <Button variant="primary" icon="heart">Want to See</Button>
        </div>
      </div>

      <div className="space-y-3">
        <p className="text-[10px] text-curtn-muted uppercase tracking-widest">Secondary CTAs</p>
        <p className="text-xs text-curtn-muted/60 mb-2">Supporting actions: lists, sharing, navigation</p>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" icon="plus">Add to List</Button>
          <Button variant="secondary" icon="copy">Share</Button>
          <Button variant="secondary" icon="ticket" iconPosition="right">Tickets</Button>
        </div>
      </div>

      <div className="space-y-3">
        <p className="text-[10px] text-curtn-muted uppercase tracking-widest">Tertiary CTAs</p>
        <p className="text-xs text-curtn-muted/60 mb-2">Admin/editing actions, load more, low-priority</p>
        <div className="flex flex-wrap gap-2">
          <Button variant="tertiary" icon="pencil">Edit</Button>
          <Button variant="tertiary" size="sm">Load More</Button>
          <Button variant="tertiary" fullWidth>Load more reviews</Button>
        </div>
      </div>

      <div className="space-y-3">
        <p className="text-[10px] text-curtn-muted uppercase tracking-widest">Sizes</p>
        <div className="flex items-end gap-2">
          <Button variant="primary" size="sm">Small</Button>
          <Button variant="primary" size="md">Medium</Button>
          <Button variant="primary" size="lg">Large</Button>
        </div>
      </div>
    </div>
  ),
};
