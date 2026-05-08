import type { Meta, StoryObj } from "@storybook/react";
import { LogForm } from "./LogForm";

const meta: Meta<typeof LogForm> = {
  title: "Forms/LogForm",
  component: LogForm,
  decorators: [(Story) => <div className="max-w-lg"><Story /></div>],
};

export default meta;
type Story = StoryObj<typeof LogForm>;

export const Blank: Story = {
  args: { runId: null },
};

export const WithPrefilledRun: Story = {
  args: { runId: "run-1" },
  parameters: {
    urqlMockData: {
      SingleRun: {
        singleRun: {
          id: "run-1",
          show: { id: "show-1", title: "Hamilton", posterUrl: null, imageUrl: null },
          productionCompany: { id: "c1", name: "The Public Theater", slug: "the-public-theater" },
          venues: [{ id: "v1", name: "Richard Rodgers Theatre", city: "New York" }],
          performances: {
            edges: [
              { node: { id: "perf-1", date: "2026-04-15", time: "19:00", venue: { id: "v1", name: "Richard Rodgers Theatre" } } },
              { node: { id: "perf-2", date: "2026-04-17", time: "20:00", venue: { id: "v1", name: "Richard Rodgers Theatre" } } },
            ],
          },
        },
      },
    },
  },
};
