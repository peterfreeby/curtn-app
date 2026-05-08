import type { Meta, StoryObj } from "@storybook/react";
import { PerformanceCreditEditor } from "./PerformanceCreditEditor";

const meta: Meta<typeof PerformanceCreditEditor> = {
  title: "Admin/PerformanceCreditEditor",
  component: PerformanceCreditEditor,
  parameters: { auth: "admin", layout: "padded" },
  decorators: [(Story) => <div className="max-w-2xl"><Story /></div>],
};

export default meta;
type Story = StoryObj<typeof PerformanceCreditEditor>;

const credit = (id: string, name: string, role: string) => ({
  id,
  person: { id: `p-${id}`, name, slug: name.toLowerCase().replace(/\s+/g, "-") },
  role,
  order: 0,
  source: "run",
});

export const WithCredits: Story = {
  args: {
    performanceId: "perf-1",
    effectiveCast: [
      credit("1", "Lin-Manuel Miranda", "Hamilton"),
      credit("2", "Leslie Odom Jr.", "Burr"),
    ],
    effectiveCrew: [credit("3", "Thomas Kail", "Director")],
    onChanged: () => alert("changed"),
  },
};

export const Empty: Story = {
  args: {
    performanceId: "perf-1",
    effectiveCast: [],
    effectiveCrew: [],
    onChanged: () => alert("changed"),
  },
};
