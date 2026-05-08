import type { Meta, StoryObj } from "@storybook/react";
import { InlineEditor } from "./InlineEditor";

const meta: Meta<typeof InlineEditor> = {
  title: "Admin/InlineEditor",
  component: InlineEditor,
  parameters: { auth: "admin", layout: "padded" },
  decorators: [(Story) => <div className="max-w-2xl"><Story /></div>],
};

export default meta;
type Story = StoryObj<typeof InlineEditor>;

export const ShowEntity: Story = {
  args: {
    entityType: "show",
    entityId: "show-1-objectid",
    initialValues: {
      title: "Hamilton",
      description: "A musical about the first Treasury Secretary.",
      performanceTypes: ["Musical"],
      duration: 165,
      intermissions: 1,
    },
  },
};

export const RunEntity: Story = {
  args: {
    entityType: "run",
    entityId: "run-1-objectid",
    initialValues: {
      startDate: "2015-08-06",
      endDate: "2026-12-31",
      description: "Broadway run.",
    },
    initialVenues: [{ id: "venue-1", name: "Richard Rodgers Theatre" }],
  },
};

export const VenueEntity: Story = {
  args: {
    entityType: "venue",
    entityId: "venue-1-objectid",
    initialValues: {
      name: "Richard Rodgers Theatre",
      address: "226 W 46th St",
      city: "New York",
      state: "NY",
      capacity: 1400,
    },
  },
};
