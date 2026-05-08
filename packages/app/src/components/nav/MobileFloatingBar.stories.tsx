import type { Meta, StoryObj } from "@storybook/react";
import { MobileFloatingBar } from "./MobileFloatingBar";

const meta: Meta<typeof MobileFloatingBar> = {
  title: "Mobile/MobileFloatingBar",
  component: MobileFloatingBar,
  parameters: {
    layout: "fullscreen",
    viewport: { defaultViewport: "mobile1" },
    nextjs: { navigation: { pathname: "/browse" } },
  },
  decorators: [
    (Story) => (
      <div className="min-h-screen bg-curtn-deep relative">
        <div className="p-4 text-xs text-curtn-muted">
          Mobile floating bar pinned to bottom. Resize to under 768px.
        </div>
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof MobileFloatingBar>;

export const Default: Story = {
  parameters: { nextjs: { navigation: { pathname: "/browse" } } },
};

export const OnFeed: Story = {
  parameters: { nextjs: { navigation: { pathname: "/feed" } } },
};

export const OnDetailPage: Story = {
  parameters: { nextjs: { navigation: { pathname: "/performances/abc-123" } } },
};
