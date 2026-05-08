import type { Meta, StoryObj } from "@storybook/react";
import { AddToListButton } from "./AddToListButton";

const meta: Meta<typeof AddToListButton> = {
  title: "Molecules/AddToListButton",
  component: AddToListButton,
  decorators: [(Story) => <div className="p-6"><Story /></div>],
};

export default meta;
type Story = StoryObj<typeof AddToListButton>;

export const Closed: Story = {
  args: { itemId: "show-1", listType: "shows" },
};

export const WithLists: Story = {
  args: { itemId: "show-1", listType: "shows" },
  parameters: {
    urqlMockData: {
      MyLists: {
        myLists: {
          edges: [
            { node: { id: "l1", name: "Must-See 2026", slug: "must-see-2026", listType: "shows", itemCount: 12, isPublic: true } },
            { node: { id: "l2", name: "Drafts", slug: "drafts", listType: "shows", itemCount: 2, isPublic: false } },
            { node: { id: "l3", name: "Brooklyn Lineup", slug: "brooklyn-lineup", listType: "shows", itemCount: 6, isPublic: true } },
          ],
        },
      },
    },
  },
};

export const SignedOut: Story = {
  args: { itemId: "show-1", listType: "shows" },
  parameters: { auth: "signed-out" },
};
