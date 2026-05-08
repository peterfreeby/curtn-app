import type { Meta, StoryObj } from "@storybook/react";
import { Icon } from "./Icons";

const meta: Meta<typeof Icon> = {
  title: "Atoms/Icon",
  component: Icon,
  argTypes: {
    name: {
      control: "select",
      options: [
        "magnifying-glass", "house", "compass", "map-pin", "plus", "user",
        "sign-out", "caret-down", "caret-left", "caret-right", "star",
        "star-half", "heart", "ticket", "calendar", "globe", "phone",
        "envelope", "arrow-left", "buildings", "eye", "eye-slash",
        "clock", "clock-countdown", "list-plus", "pencil", "ghost",
        "list-bullets", "users-three", "copy", "trash", "lightning",
        "folder-simple", "folder-simple-plus", "check",
      ],
    },
    weight: { control: "select", options: ["regular", "bold", "light", "thin", "fill", "duotone"] },
    size: { control: { type: "range", min: 12, max: 64, step: 2 } },
  },
};

export default meta;
type Story = StoryObj<typeof Icon>;

export const Default: Story = {
  args: { name: "star", weight: "regular", size: 24 },
};

export const Filled: Story = {
  args: { name: "heart", weight: "fill", size: 32 },
};

const ALL_NAMES = [
  "magnifying-glass", "house", "compass", "map-pin", "plus", "user",
  "sign-out", "caret-down", "caret-left", "caret-right", "star",
  "star-half", "heart", "ticket", "calendar", "globe", "phone",
  "envelope", "arrow-left", "buildings", "eye", "eye-slash",
  "clock", "clock-countdown", "list-plus", "pencil", "ghost",
  "list-bullets", "users-three", "copy", "trash", "lightning",
  "folder-simple", "folder-simple-plus", "check",
] as const;

export const AllIcons: Story = {
  render: () => (
    <div className="grid grid-cols-6 gap-4 max-w-2xl">
      {ALL_NAMES.map((n) => (
        <div key={n} className="flex flex-col items-center gap-1 p-3 border border-curtn-dark/40 bg-curtn-surface">
          <Icon name={n} size={24} className="text-curtn-cream" />
          <span className="text-[9px] text-curtn-muted uppercase tracking-widest">{n}</span>
        </div>
      ))}
    </div>
  ),
};

export const AllWeights: Story = {
  render: () => (
    <div className="flex gap-6 items-end">
      {(["thin", "light", "regular", "bold", "fill", "duotone"] as const).map((w) => (
        <div key={w} className="flex flex-col items-center gap-2">
          <Icon name="heart" weight={w} size={40} className="text-curtn-coral" />
          <span className="text-[10px] text-curtn-muted uppercase tracking-widest">{w}</span>
        </div>
      ))}
    </div>
  ),
};
