import type { Meta, StoryObj } from "@storybook/react";
import { ClaimPrompt } from "./ClaimPrompt";

const meta: Meta<typeof ClaimPrompt> = {
  title: "Organisms/Profile/ClaimPrompt",
  component: ClaimPrompt,
  decorators: [(Story) => <div className="max-w-md"><Story /></div>],
};

export default meta;
type Story = StoryObj<typeof ClaimPrompt>;

export const Collapsed: Story = {
  args: { onSubmitted: () => alert("submitted") },
};

export const Pending: Story = {
  args: { onSubmitted: () => alert("submitted") },
  parameters: {
    urqlMockData: {
      MyClaimRequest: {
        myClaimRequest: {
          id: "cr-1",
          status: "pending",
          person: { id: "p-1", name: "Sarah Kim" },
        },
      },
    },
  },
};
