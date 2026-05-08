import type { Meta, StoryObj } from "@storybook/react";
import { ListCreateForm } from "./ListCreateForm";

const meta: Meta<typeof ListCreateForm> = {
  title: "Forms/ListCreateForm",
  component: ListCreateForm,
  decorators: [(Story) => <div className="max-w-lg"><Story /></div>],
};

export default meta;
type Story = StoryObj<typeof ListCreateForm>;

export const Default: Story = {};
