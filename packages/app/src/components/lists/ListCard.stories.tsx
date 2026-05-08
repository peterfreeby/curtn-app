import type { Meta, StoryObj } from "@storybook/react";
import { ListCard } from "./ListCard";

const meta: Meta<typeof ListCard> = {
  title: "Molecules/ListCard",
  component: ListCard,
  decorators: [(Story) => <div className="max-w-md"><Story /></div>],
};

export default meta;
type Story = StoryObj<typeof ListCard>;

const POSTERS = [
  "https://picsum.photos/seed/list-1/160/240",
  "https://picsum.photos/seed/list-2/160/240",
  "https://picsum.photos/seed/list-3/160/240",
  "https://picsum.photos/seed/list-4/160/240",
  "https://picsum.photos/seed/list-5/160/240",
];

export const WithPosters: Story = {
  args: {
    name: "Must-See 2026",
    slug: "must-see-2026",
    listType: "shows",
    itemCount: 12,
    ownerUsername: "sarahk",
    ownerAvatarUrl: "https://i.pravatar.cc/40?img=3",
    isPublic: true,
    description: "The ones I'm prioritizing this year.",
    posterUrls: POSTERS,
  },
};

export const NoPosters: Story = {
  args: {
    name: "Watchlist",
    slug: "watchlist",
    listType: "runs",
    itemCount: 4,
    ownerUsername: "marcust",
    isPublic: false,
    description: "Private saved runs.",
  },
};

export const Private: Story = {
  args: {
    name: "Drafts",
    slug: "drafts",
    listType: "shows",
    itemCount: 2,
    ownerUsername: "lenar",
    isPublic: false,
    posterUrls: POSTERS.slice(0, 2),
  },
};

export const VenueList: Story = {
  args: {
    name: "Brooklyn Venues",
    slug: "brooklyn-venues",
    listType: "venues",
    itemCount: 8,
    ownerUsername: "peter",
    isPublic: true,
    description: "Every spot I've been to on the BK side.",
    posterUrls: POSTERS,
  },
};
