import type { Meta, StoryObj } from "@storybook/react";
import { AddCreditForm } from "./AddCreditForm";

const meta: Meta<typeof AddCreditForm> = {
  title: "Forms/AddCreditForm",
  component: AddCreditForm,
  decorators: [(Story) => <div className="max-w-md"><Story /></div>],
};

export default meta;
type Story = StoryObj<typeof AddCreditForm>;

export const Default: Story = {
  args: { runId: "run-1", onAdded: () => alert("credit added") },
};
