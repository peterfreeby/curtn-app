import type { Meta, StoryObj } from "@storybook/react";
import { ListCardSkeleton } from "./ListCardSkeleton";

const meta: Meta<typeof ListCardSkeleton> = {
  title: "Molecules/Skeletons/ListCardSkeleton",
  component: ListCardSkeleton,
  decorators: [(Story) => <div className="max-w-md"><Story /></div>],
};

export default meta;
type Story = StoryObj<typeof ListCardSkeleton>;

export const Default: Story = {};

export const Stack: Story = {
  render: () => (
    <div className="flex flex-col gap-8 max-w-md">
      <ListCardSkeleton />
      <ListCardSkeleton />
      <ListCardSkeleton />
    </div>
  ),
};
