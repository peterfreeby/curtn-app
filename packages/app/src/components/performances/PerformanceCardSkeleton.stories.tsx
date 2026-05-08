import type { Meta, StoryObj } from "@storybook/react";
import { PerformanceCardSkeleton } from "./PerformanceCardSkeleton";

const meta: Meta<typeof PerformanceCardSkeleton> = {
  title: "Molecules/Skeletons/PerformanceCardSkeleton",
  component: PerformanceCardSkeleton,
  decorators: [(Story) => <div className="max-w-xs"><Story /></div>],
};

export default meta;
type Story = StoryObj<typeof PerformanceCardSkeleton>;

export const Default: Story = {};

export const Grid: Story = {
  render: () => (
    <div className="grid grid-cols-3 gap-4 max-w-3xl">
      <PerformanceCardSkeleton />
      <PerformanceCardSkeleton />
      <PerformanceCardSkeleton />
      <PerformanceCardSkeleton />
      <PerformanceCardSkeleton />
      <PerformanceCardSkeleton />
    </div>
  ),
};
