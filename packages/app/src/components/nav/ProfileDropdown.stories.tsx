import type { Meta, StoryObj } from "@storybook/react";
import { ProfileDropdown } from "./ProfileDropdown";

const meta: Meta<typeof ProfileDropdown> = {
  title: "Molecules/Nav/ProfileDropdown",
  component: ProfileDropdown,
  decorators: [(Story) => <div className="flex justify-end p-8 min-h-[240px]"><Story /></div>],
};

export default meta;
type Story = StoryObj<typeof ProfileDropdown>;

export const Closed: Story = {};

export const SignedOut: Story = {
  parameters: { auth: "signed-out" },
};
