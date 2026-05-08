import type { Meta, StoryObj } from "@storybook/react";
import { SmartLogForm } from "./SmartLogForm";

const meta: Meta<typeof SmartLogForm> = {
  title: "Forms/SmartLogForm",
  component: SmartLogForm,
};

export default meta;
type Story = StoryObj<typeof SmartLogForm>;

export const Empty: Story = {};

export const WithNearbyVenues: Story = {
  parameters: {
    urqlMockData: {
      VenuesNear: {
        venuesNear: {
          edges: [
            { node: { id: "v1", name: "Richard Rodgers Theatre", city: "New York", state: "NY" } },
            { node: { id: "v2", name: "Hudson Theatre", city: "New York", state: "NY" } },
            { node: { id: "v3", name: "Winter Garden", city: "New York", state: "NY" } },
          ],
        },
      },
    },
  },
};
