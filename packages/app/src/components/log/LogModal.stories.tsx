import type { Meta, StoryObj } from "@storybook/react";
import { LogModal } from "./LogModal";

const meta: Meta<typeof LogModal> = {
  title: "Organisms/LogModal",
  component: LogModal,
  parameters: { layout: "fullscreen" },
};

export default meta;
type Story = StoryObj<typeof LogModal>;

export const SignedIn: Story = {};

export const SignedOut: Story = {
  parameters: { auth: "signed-out" },
};
