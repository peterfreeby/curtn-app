import type { Meta, StoryObj } from "@storybook/react";
import { LogButton } from "./LogButton";

const meta: Meta<typeof LogButton> = {
  title: "Atoms/LogButton",
  component: LogButton,
};

export default meta;
type Story = StoryObj<typeof LogButton>;

export const Default: Story = {};
