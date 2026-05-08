import type { Meta, StoryObj } from "@storybook/react";
import { ListItemRow } from "./ListItemRow";

const meta: Meta<typeof ListItemRow> = {
  title: "Molecules/ListItemRow",
  component: ListItemRow,
  decorators: [(Story) => <div className="max-w-xl"><Story /></div>],
};

export default meta;
type Story = StoryObj<typeof ListItemRow>;

export const ShowItem: Story = {
  args: {
    listType: "shows",
    canEdit: true,
    onRemove: () => alert("remove"),
    item: {
      item: {
        __typename: "Show",
        showId: "show-1",
        showTitle: "Hamilton",
        performanceTypes: ["Musical"],
        posterUrl: "https://picsum.photos/seed/li-hamilton/100/150",
      },
      note: null,
    },
  },
};

export const VenueItem: Story = {
  args: {
    listType: "venues",
    canEdit: false,
    item: {
      item: {
        __typename: "Venue",
        venueId: "v1",
        venueSlug: "richard-rodgers-theatre",
        venueName: "Richard Rodgers Theatre",
        city: "New York",
        state: "NY",
        venueImageUrl: "https://picsum.photos/seed/li-rr/100/100",
      },
      note: null,
    },
  },
};

export const PersonItem: Story = {
  args: {
    listType: "people",
    canEdit: true,
    onRemove: () => alert("remove"),
    item: {
      item: {
        __typename: "Person",
        personId: "p1",
        personSlug: "lin-manuel-miranda",
        personName: "Lin-Manuel Miranda",
        headshotUrl: "https://i.pravatar.cc/100?img=8",
      },
      note: "Saw Hamilton opening night",
    },
  },
};

export const RunItem: Story = {
  args: {
    listType: "runs",
    canEdit: false,
    item: {
      item: {
        __typename: "Run",
        runId: "run-1",
        runTitle: "Hamilton (Broadway Run)",
        startDate: "2015-08-06",
        endDate: "2026-12-31",
      },
      note: null,
    },
  },
};

export const NoImage: Story = {
  args: {
    listType: "shows",
    canEdit: false,
    item: {
      item: {
        __typename: "Show",
        showId: "show-2",
        showTitle: "Untitled Workshop",
        performanceTypes: ["Drama"],
      },
      note: null,
    },
  },
};
