import type { Meta, StoryObj } from "@storybook/react";
import { AddSiblingActions } from "./AddSiblingActions";

const meta: Meta<typeof AddSiblingActions> = {
  title: "Admin/AddSiblingActions",
  component: AddSiblingActions,
  decorators: [(Story) => <div className="max-w-xl"><Story /></div>],
  parameters: { auth: "admin" },
};

export default meta;
type Story = StoryObj<typeof AddSiblingActions>;

export const AddRunOnly: Story = {
  args: {
    showId: "show-1",
    showAddRun: true,
    onRunCreated: (id) => alert(`run ${id}`),
  },
};

export const AddPerformanceOnly: Story = {
  args: {
    showId: "show-1",
    runId: "run-1",
    venueId: "v-1",
    showAddPerformance: true,
    onPerformanceCreated: () => alert("performance created"),
  },
};

export const Both: Story = {
  args: {
    showId: "show-1",
    runId: "run-1",
    venueId: "v-1",
    showAddRun: true,
    showAddPerformance: true,
    onRunCreated: (id) => alert(`run ${id}`),
    onPerformanceCreated: () => alert("performance created"),
  },
};
