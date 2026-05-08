import type { Meta, StoryObj } from "@storybook/react";
import { EntityDataSourcesPanel } from "./EntityDataSourcesPanel";

const meta: Meta<typeof EntityDataSourcesPanel> = {
  title: "Admin/EntityDataSourcesPanel",
  component: EntityDataSourcesPanel,
  parameters: { auth: "admin", layout: "padded" },
  decorators: [(Story) => <div className="max-w-2xl"><Story /></div>],
};

export default meta;
type Story = StoryObj<typeof EntityDataSourcesPanel>;

// Base64 of "Show:show-1"
const encodedShowId = btoa("Show:show-1");

export const ShowSources: Story = {
  args: {
    entityType: "show",
    entityId: encodedShowId,
  },
  parameters: {
    urqlMockData: {
      DataSourceList: {
        dataSourceList: {
          edges: [
            { node: { id: "ds-1", name: "Playbill API", type: "api", url: "https://playbill.com" } },
            { node: { id: "ds-2", name: "Internal Entry", type: "manual" } },
          ],
        },
      },
    },
  },
};

export const VenueSources: Story = {
  args: {
    entityType: "venue",
    entityId: btoa("Venue:venue-1"),
  },
};

export const Empty: Story = {
  args: {
    entityType: "show",
    entityId: encodedShowId,
  },
};
