import type { Meta, StoryObj } from "@storybook/react";
import { VenueSearch } from "./VenueSearch";

const meta: Meta<typeof VenueSearch> = {
  title: "Forms/VenueSearch",
  component: VenueSearch,
  decorators: [(Story) => <div className="max-w-md"><Story /></div>],
};

export default meta;
type Story = StoryObj<typeof VenueSearch>;

export const Default: Story = {
  args: { onSelect: (v) => alert(`Selected: ${v.name}`), canCreate: false },
};

export const CanCreate: Story = {
  args: { onSelect: (v) => alert(`Selected: ${v.name}`), canCreate: true },
};
