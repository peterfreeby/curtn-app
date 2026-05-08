import type { Meta, StoryObj } from "@storybook/react";
import { VenueCardSkeleton } from "./VenueCardSkeleton";

const meta: Meta<typeof VenueCardSkeleton> = {
  title: "Molecules/Skeletons/VenueCardSkeleton",
  component: VenueCardSkeleton,
  decorators: [(Story) => <div className="max-w-sm"><Story /></div>],
};

export default meta;
type Story = StoryObj<typeof VenueCardSkeleton>;

export const Default: Story = {};

export const Grid: Story = {
  render: () => (
    <div className="grid grid-cols-2 gap-4 max-w-2xl">
      <VenueCardSkeleton />
      <VenueCardSkeleton />
      <VenueCardSkeleton />
      <VenueCardSkeleton />
    </div>
  ),
};
