import type { Meta, StoryObj } from "@storybook/react";
import { DesktopNav } from "./DesktopNav";

const meta: Meta<typeof DesktopNav> = {
  title: "Organisms/Nav/DesktopNav",
  component: DesktopNav,
  parameters: {
    layout: "fullscreen",
    nextjs: { navigation: { pathname: "/feed" } },
  },
  decorators: [
    (Story) => (
      <div className="min-h-screen bg-curtn-deep relative">
        <Story />
        <div className="pt-24 px-6 text-xs text-curtn-muted">Content area.</div>
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof DesktopNav>;

export const SignedIn: Story = {};

export const SignedOut: Story = {
  parameters: { auth: "signed-out" },
};

export const Admin: Story = {
  parameters: { auth: "admin" },
};
