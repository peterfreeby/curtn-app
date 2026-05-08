import type { Meta, StoryObj } from "@storybook/react";
import { ShowSearch } from "./ShowSearch";

const meta: Meta<typeof ShowSearch> = {
  title: "Forms/ShowSearch",
  component: ShowSearch,
  decorators: [(Story) => <div className="max-w-md"><Story /></div>],
};

export default meta;
type Story = StoryObj<typeof ShowSearch>;

export const Default: Story = {
  args: { onSelect: (s) => alert(`Selected: ${s.title}`) },
};

export const CanCreate: Story = {
  args: {
    onSelect: (s) => alert(`Selected: ${s.title}`),
    canCreate: true,
    onCreateNew: (q) => alert(`Create new: ${q}`),
  },
};
