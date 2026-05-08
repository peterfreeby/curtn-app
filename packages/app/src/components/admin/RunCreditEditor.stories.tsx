import type { Meta, StoryObj } from "@storybook/react";
import { RunCreditEditor } from "./RunCreditEditor";

const meta: Meta<typeof RunCreditEditor> = {
  title: "Admin/RunCreditEditor",
  component: RunCreditEditor,
  parameters: { auth: "admin", layout: "padded" },
  decorators: [(Story) => <div className="max-w-2xl"><Story /></div>],
};

export default meta;
type Story = StoryObj<typeof RunCreditEditor>;

const credit = (id: string, name: string, role: string) => ({
  id,
  person: { id: `p-${id}`, name, slug: name.toLowerCase().replace(/\s+/g, "-") },
  role,
  order: 0,
  source: "run",
});

export const WithCredits: Story = {
  args: {
    runId: "run-1",
    showId: "show-1",
    cast: [
      credit("1", "Lin-Manuel Miranda", "Hamilton"),
      credit("2", "Leslie Odom Jr.", "Burr"),
    ],
    crew: [credit("3", "Thomas Kail", "Director")],
    showCredits: [
      { id: "sc-1", role: "Writer", person: { name: "Lin-Manuel Miranda" } },
    ],
    onChanged: () => alert("changed"),
  },
};

export const Empty: Story = {
  args: {
    runId: "run-1",
    showId: "show-1",
    cast: [],
    crew: [],
    showCredits: [],
    onChanged: () => alert("changed"),
  },
};
