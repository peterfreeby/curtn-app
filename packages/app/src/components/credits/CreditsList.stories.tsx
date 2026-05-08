import type { Meta, StoryObj } from "@storybook/react";
import { CreditsList } from "./CreditsList";

const meta: Meta<typeof CreditsList> = {
  title: "Organisms/CreditsList",
  component: CreditsList,
  decorators: [(Story) => <div className="max-w-xl"><Story /></div>],
};

export default meta;
type Story = StoryObj<typeof CreditsList>;

const credit = (id: string, name: string, slug: string, role: string, order: number, headshot?: string) => ({
  id,
  person: { id: `p-${id}`, name, slug, headshotUrl: headshot ?? null },
  role,
  order,
});

export const Full: Story = {
  args: {
    cast: [
      credit("1", "Lin-Manuel Miranda", "lin-manuel-miranda", "Alexander Hamilton", 1, "https://i.pravatar.cc/80?img=8"),
      credit("2", "Leslie Odom Jr.", "leslie-odom-jr", "Aaron Burr", 2, "https://i.pravatar.cc/80?img=15"),
      credit("3", "Phillipa Soo", "phillipa-soo", "Eliza Hamilton", 3),
      credit("4", "Renée Elise Goldsberry", "renee-elise-goldsberry", "Angelica Schuyler", 4, "https://i.pravatar.cc/80?img=20"),
    ],
    crew: [
      credit("5", "Thomas Kail", "thomas-kail", "Director", 1, "https://i.pravatar.cc/80?img=13"),
      credit("6", "Andy Blankenbuehler", "andy-blankenbuehler", "Choreographer", 2),
      credit("7", "Alex Lacamoire", "alex-lacamoire", "Music Supervisor", 3, "https://i.pravatar.cc/80?img=33"),
    ],
  },
};

export const CastOnly: Story = {
  args: {
    cast: [credit("1", "Actor", "actor", "Lead", 1)],
    crew: [],
  },
};

export const Empty: Story = {
  args: { cast: [], crew: [] },
};
