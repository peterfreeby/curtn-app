import type { Meta, StoryObj } from "@storybook/react";
import { PerformanceSearch } from "./PerformanceSearch";

const meta: Meta<typeof PerformanceSearch> = {
  title: "Forms/PerformanceSearch",
  component: PerformanceSearch,
  decorators: [(Story) => <div className="max-w-md"><Story /></div>],
};

export default meta;
type Story = StoryObj<typeof PerformanceSearch>;

export const Default: Story = {
  args: { onSelect: (p) => alert(`Selected: ${p.title}`) },
};
