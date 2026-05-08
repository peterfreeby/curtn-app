import type { Meta, StoryObj } from "@storybook/react";
import { SeenCard } from "./SeenCard";

const meta: Meta<typeof SeenCard> = {
  title: "Organisms/SeenCard",
  component: SeenCard,
  decorators: [(Story) => <div className="max-w-md"><Story /></div>],
};

export default meta;
type Story = StoryObj<typeof SeenCard>;

const baseSeen = {
  id: "s1",
  createdAt: "2026-04-15T20:00:00Z",
  user: {
    id: "u1",
    username: "sarahk",
    fullName: "Sarah Kim",
    avatarUrl: "https://i.pravatar.cc/40?img=3",
  },
  run: {
    id: "r1",
    startDate: "2026-04-01",
    endDate: "2026-07-30",
    show: {
      id: "sh1",
      title: "Hamilton",
      posterUrl: "https://picsum.photos/seed/seen-hamilton/80/120",
    },
    venues: [{ name: "Richard Rodgers Theatre", city: "New York" }],
  },
};

export const WithUser: Story = {
  args: { seen: baseSeen, showUser: true },
};

export const RunOnly: Story = {
  args: { seen: baseSeen, showUser: false },
};

export const NoPoster: Story = {
  args: {
    seen: {
      ...baseSeen,
      run: { ...baseSeen.run, show: { id: "sh2", title: "Untitled Work-in-Progress" } },
    },
    showUser: true,
  },
};

export const NoUser: Story = {
  args: {
    seen: { ...baseSeen, user: null },
    showUser: false,
  },
};

export const Feed: Story = {
  render: () => (
    <div className="max-w-md">
      <SeenCard seen={baseSeen} showUser={true} />
      <SeenCard
        seen={{
          ...baseSeen,
          id: "s2",
          user: { id: "u2", username: "marcust", fullName: "Marcus Torres" },
          run: {
            ...baseSeen.run,
            id: "r2",
            show: { id: "sh3", title: "The Book of Mormon", posterUrl: "https://picsum.photos/seed/seen-bom/80/120" },
          },
        }}
        showUser={true}
      />
      <SeenCard
        seen={{
          ...baseSeen,
          id: "s3",
          user: { id: "u3", username: "lenar", fullName: "Lena Rivera" },
          run: {
            ...baseSeen.run,
            id: "r3",
            show: { id: "sh4", title: "Macbeth", posterUrl: "https://picsum.photos/seed/seen-macbeth/80/120" },
          },
        }}
        showUser={true}
      />
    </div>
  ),
};
