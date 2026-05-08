import type { Meta, StoryObj } from "@storybook/react";
import { DetailBreadcrumb } from "./DetailBreadcrumb";

const meta: Meta<typeof DetailBreadcrumb> = {
  title: "Molecules/Nav/DetailBreadcrumb",
  component: DetailBreadcrumb,
  parameters: { layout: "fullscreen" },
  decorators: [(Story) => <div className="relative h-24 bg-curtn-deep"><Story /></div>],
};

export default meta;
type Story = StoryObj<typeof DetailBreadcrumb>;

export const TwoLevels: Story = {
  args: {
    levels: [
      { label: "Browse", href: "/browse" },
      { label: "Hamilton" },
    ],
  },
};

export const ThreeLevels: Story = {
  args: {
    levels: [
      { label: "Browse", href: "/browse" },
      { label: "Hamilton", href: "/performances/hamilton" },
      { label: "Broadway Run" },
    ],
  },
};

export const DeepNav: Story = {
  args: {
    levels: [
      { label: "Venues", href: "/venues" },
      { label: "Richard Rodgers Theatre", href: "/venues/richard-rodgers-theatre" },
      { label: "Hamilton", href: "/performances/hamilton" },
      { label: "April 15, 2026" },
    ],
  },
};
