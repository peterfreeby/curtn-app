import type { Meta, StoryObj } from "@storybook/react";
import { SearchTrigger } from "./SearchTrigger";

const meta: Meta<typeof SearchTrigger> = {
  title: "Atoms/SearchTrigger",
  component: SearchTrigger,
};

export default meta;
type Story = StoryObj<typeof SearchTrigger>;

export const Default: Story = {};
