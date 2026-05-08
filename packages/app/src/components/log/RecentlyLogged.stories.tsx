import type { Meta, StoryObj } from "@storybook/react";
import { useEffect } from "react";
import { RecentlyLogged } from "./RecentlyLogged";

const meta: Meta<typeof RecentlyLogged> = {
  title: "Molecules/RecentlyLogged",
  component: RecentlyLogged,
  parameters: { layout: "padded" },
};

export default meta;
type Story = StoryObj<typeof RecentlyLogged>;

function seedRecentLog(log: { runId: string; showTitle: string; venueName: string | null; rating: number }) {
  const record = { ...log, timestamp: Date.now() - 30 * 1000 };
  localStorage.setItem("curtn_recent_log", JSON.stringify(record));
}

function ClearLog() {
  useEffect(() => {
    return () => localStorage.removeItem("curtn_recent_log");
  }, []);
  return null;
}

export const JustLogged: Story = {
  render: () => {
    seedRecentLog({ runId: "run-1", showTitle: "Hamilton", venueName: "Richard Rodgers Theatre", rating: 4.5 });
    return (
      <>
        <ClearLog />
        <RecentlyLogged />
      </>
    );
  },
};

export const NoVenue: Story = {
  render: () => {
    seedRecentLog({ runId: "run-2", showTitle: "Workshop Reading", venueName: null, rating: 3 });
    return (
      <>
        <ClearLog />
        <RecentlyLogged />
      </>
    );
  },
};

export const Empty: Story = {
  render: () => {
    localStorage.removeItem("curtn_recent_log");
    return (
      <div>
        <RecentlyLogged />
        <p className="text-xs text-curtn-muted">No recent log — component renders nothing.</p>
      </div>
    );
  },
};
