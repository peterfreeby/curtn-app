import type { Meta, StoryObj } from "@storybook/react";
import { ListGrid } from "./ListGrid";

const meta: Meta<typeof ListGrid> = {
  title: "Organisms/ListGrid",
  component: ListGrid,
  parameters: { layout: "padded" },
};

export default meta;
type Story = StoryObj<typeof ListGrid>;

const mkList = (id: string, name: string, posters: number) => ({
  id,
  name,
  slug: name.toLowerCase().replace(/\s+/g, "-"),
  listType: "shows",
  itemCount: posters,
  isPublic: true,
  description: null,
  owner: { username: "sarahk", avatarUrl: "https://i.pravatar.cc/40?img=3" },
  items: {
    edges: Array.from({ length: posters }).map((_, i) => ({
      node: {
        item: {
          __typename: "Show",
          posterUrl: `https://picsum.photos/seed/lg-${id}-${i}/160/240`,
        },
      },
    })),
  },
});

export const Populated: Story = {
  args: {
    loading: false,
    lists: [
      mkList("1", "Must-See 2026", 5),
      mkList("2", "Brooklyn Spring", 3),
      mkList("3", "Drafts", 2),
      mkList("4", "Watchlist", 4),
      mkList("5", "Revisit List", 5),
      mkList("6", "Favorites", 5),
    ],
  },
};

export const Loading: Story = {
  args: { loading: true, lists: [] },
};

export const Empty: Story = {
  args: { loading: false, lists: [] },
};

export const EmptyWithCustomMessage: Story = {
  args: { loading: false, lists: [], emptyMessage: "You haven't created any lists yet." },
};
