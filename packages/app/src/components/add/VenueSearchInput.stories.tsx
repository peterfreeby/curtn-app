import type { Meta, StoryObj } from "@storybook/react";
import { VenueSearchInput } from "./VenueSearchInput";

const meta: Meta<typeof VenueSearchInput> = {
  title: "Forms/VenueSearchInput",
  component: VenueSearchInput,
  decorators: [(Story) => <div className="max-w-md"><Story /></div>],
};

export default meta;
type Story = StoryObj<typeof VenueSearchInput>;

export const Default: Story = {
  args: { onSelect: (v) => alert(`Selected: ${v.name}`) },
};
