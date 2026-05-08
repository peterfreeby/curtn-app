import type { Meta, StoryObj } from "@storybook/react";
import { MobileTopBar } from "./MobileTopBar";

const meta: Meta<typeof MobileTopBar> = {
  title: "Mobile/MobileTopBar",
  component: MobileTopBar,
  parameters: {
    layout: "fullscreen",
    viewport: { defaultViewport: "mobile1" },
  },
  decorators: [
    (Story) => (
      <div className="min-h-screen bg-curtn-deep relative">
        <Story />
        <div className="pt-20 p-4 text-xs text-curtn-muted">
          Mobile top bar pinned to top. Resize to under 768px.
        </div>
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof MobileTopBar>;

export const SignedIn: Story = {};

export const SignedOut: Story = {
  parameters: { auth: "signed-out" },
};
