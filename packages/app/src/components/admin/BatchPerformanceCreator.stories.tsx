import type { Meta, StoryObj } from "@storybook/react";
import { BatchPerformanceCreator } from "./BatchPerformanceCreator";

const meta: Meta<typeof BatchPerformanceCreator> = {
  title: "Admin/BatchPerformanceCreator",
  component: BatchPerformanceCreator,
  parameters: { auth: "admin", layout: "padded" },
  decorators: [(Story) => <div className="max-w-2xl"><Story /></div>],
};

export default meta;
type Story = StoryObj<typeof BatchPerformanceCreator>;

export const WithRunDates: Story = {
  args: {
    runId: "run-1",
    venueId: "venue-1",
    startDate: "2026-04-01",
    endDate: "2026-07-30",
    onCreated: () => alert("created"),
    onCancel: () => alert("cancel"),
  },
};

export const NoDates: Story = {
  args: {
    runId: "run-1",
    venueId: "venue-1",
    onCreated: () => alert("created"),
    onCancel: () => alert("cancel"),
  },
};
