import type { Meta, StoryObj } from "@storybook/react";
import { ShowingsList } from "./ShowingsList";

const meta: Meta<typeof ShowingsList> = {
  title: "Organisms/ShowingsList",
  component: ShowingsList,
  decorators: [(Story) => <div className="max-w-md"><Story /></div>],
};

export default meta;
type Story = StoryObj<typeof ShowingsList>;

const venue = { id: "v1", name: "Richard Rodgers Theatre" };

const showings = [
  { id: "s1", date: "2026-04-15", time: "19:00", venue, ticketUrl: "https://example.com", soldOut: false },
  { id: "s2", date: "2026-04-16", time: "20:00", venue, ticketUrl: "https://example.com", soldOut: false },
  { id: "s3", date: "2026-04-17", time: "14:00", venue, ticketUrl: null, soldOut: true },
  { id: "s4", date: "2026-04-18", time: "19:00", venue, ticketUrl: "https://example.com", soldOut: false },
  { id: "s5", date: "2026-04-19", time: "20:00", venue, ticketUrl: "https://example.com", soldOut: false },
  { id: "s6", date: "2026-04-20", time: "19:00", venue, ticketUrl: "https://example.com", soldOut: false },
  { id: "s7", date: "2026-04-22", time: "20:00", venue, ticketUrl: "https://example.com", soldOut: false },
];

export const UpcomingShowings: Story = {
  args: { showings, label: "Upcoming performances", runId: "run-1" },
};

export const WithAddButton: Story = {
  args: {
    showings: showings.slice(0, 3),
    label: "Performances",
    runId: "run-1",
    onAdd: () => alert("Add performance"),
  },
};

export const Empty: Story = {
  args: { showings: [], label: "Performances" },
};
