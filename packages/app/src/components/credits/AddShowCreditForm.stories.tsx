import type { Meta, StoryObj } from "@storybook/react";
import { AddShowCreditForm } from "./AddShowCreditForm";

const meta: Meta<typeof AddShowCreditForm> = {
  title: "Forms/AddShowCreditForm",
  component: AddShowCreditForm,
  decorators: [(Story) => <div className="max-w-md"><Story /></div>],
};

export default meta;
type Story = StoryObj<typeof AddShowCreditForm>;

export const Default: Story = {
  args: { showId: "show-1", onAdded: () => alert("credit added") },
};
