import type { Meta, StoryObj } from "@storybook/react";
import { ClaimPersonButton } from "./ClaimPersonButton";

const meta: Meta<typeof ClaimPersonButton> = {
  title: "Molecules/ClaimPersonButton",
  component: ClaimPersonButton,
  decorators: [(Story) => <div className="p-6"><Story /></div>],
};

export default meta;
type Story = StoryObj<typeof ClaimPersonButton>;

export const Unclaimed: Story = {
  args: {
    personId: "p-1",
    isClaimed: false,
  },
};

export const ClaimedByOther: Story = {
  args: {
    personId: "p-1",
    isClaimed: true,
    claimedByUser: { id: "u-other", username: "someone-else" },
  },
};

export const ClaimedByMe: Story = {
  args: {
    personId: "p-1",
    isClaimed: true,
    claimedByUser: { id: "story-user-1", username: "storyviewer" },
  },
};

export const Pending: Story = {
  args: {
    personId: "p-1",
    isClaimed: false,
  },
  parameters: {
    urqlMockData: {
      MyClaimRequest: {
        myClaimRequest: {
          id: "cr-1",
          status: "pending",
          person: { id: "p-1", name: "Someone" },
        },
      },
    },
  },
};

export const SignedOut: Story = {
  args: { personId: "p-1", isClaimed: false },
  parameters: { auth: "signed-out" },
};
