import type { Meta, StoryObj } from "@storybook/react";
import { PersonHero } from "./PersonHero";

const meta: Meta<typeof PersonHero> = {
  title: "Organisms/PersonHero",
  component: PersonHero,
  parameters: { layout: "padded" },
};

export default meta;
type Story = StoryObj<typeof PersonHero>;

export const WithHeadshot: Story = {
  args: {
    name: "Lin-Manuel Miranda",
    bio: "American composer, lyricist, and actor. Known for creating and starring in the Broadway musicals Hamilton and In the Heights. His work across theater, film, and television has earned him numerous awards including a Pulitzer Prize.",
    headshotUrl: "https://i.pravatar.cc/200?img=8",
  },
};

export const NoHeadshot: Story = {
  args: {
    name: "Jessica Stone",
    bio: "Director.",
    headshotUrl: null,
  },
};

export const ShortBio: Story = {
  args: {
    name: "Thomas Kail",
    bio: "Director.",
    headshotUrl: "https://i.pravatar.cc/200?img=13",
  },
};

export const NoBio: Story = {
  args: {
    name: "Alex Lacamoire",
    bio: null,
    headshotUrl: "https://i.pravatar.cc/200?img=33",
  },
};
