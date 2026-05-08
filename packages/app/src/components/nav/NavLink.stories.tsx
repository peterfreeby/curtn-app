import type { Meta, StoryObj } from "@storybook/react";
import { NavLink } from "./NavLink";

const meta: Meta<typeof NavLink> = {
  title: "Molecules/NavLink",
  component: NavLink,
  parameters: {
    nextjs: { navigation: { pathname: "/feed" } },
  },
};

export default meta;
type Story = StoryObj<typeof NavLink>;

export const Active: Story = {
  args: { href: "/feed", children: "Feed" },
};

export const Inactive: Story = {
  args: { href: "/discover", children: "Discover" },
};

export const NavBar: Story = {
  render: () => (
    <nav className="flex gap-6 border-b border-curtn-dark/40 pb-2">
      <NavLink href="/feed">Feed</NavLink>
      <NavLink href="/discover">Discover</NavLink>
      <NavLink href="/lists">Lists</NavLink>
      <NavLink href="/watchlist">Watchlist</NavLink>
    </nav>
  ),
};
