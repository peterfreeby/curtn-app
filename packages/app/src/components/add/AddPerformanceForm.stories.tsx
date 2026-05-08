import type { Meta, StoryObj } from "@storybook/react";
import { AddPerformanceForm } from "./AddPerformanceForm";

const meta: Meta<typeof AddPerformanceForm> = {
  title: "Forms/AddPerformanceForm",
  component: AddPerformanceForm,
  decorators: [(Story) => <div className="max-w-2xl"><Story /></div>],
};

export default meta;
type Story = StoryObj<typeof AddPerformanceForm>;

export const Default: Story = {};
