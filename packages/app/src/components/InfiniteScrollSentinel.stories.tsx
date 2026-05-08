import type { Meta, StoryObj } from "@storybook/react";
import { useRef } from "react";
import { InfiniteScrollSentinel } from "./InfiniteScrollSentinel";

const meta: Meta<typeof InfiniteScrollSentinel> = {
  title: "Molecules/InfiniteScrollSentinel",
  component: InfiniteScrollSentinel,
  argTypes: {
    loadingMore: { control: "boolean" },
    hasNextPage: { control: "boolean" },
  },
};

export default meta;
type Story = StoryObj<typeof InfiniteScrollSentinel>;

function Wrapper({ loadingMore, hasNextPage }: { loadingMore: boolean; hasNextPage: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  return (
    <div className="bg-curtn-surface p-6 max-w-md">
      <p className="text-xs text-curtn-muted mb-3">Items above the sentinel…</p>
      <InfiniteScrollSentinel sentinelRef={ref} loadingMore={loadingMore} hasNextPage={hasNextPage} />
    </div>
  );
}

export const Loading: Story = {
  render: () => <Wrapper loadingMore={true} hasNextPage={true} />,
};

export const IdleHasMore: Story = {
  render: () => <Wrapper loadingMore={false} hasNextPage={true} />,
};

export const NoMore: Story = {
  render: () => <Wrapper loadingMore={false} hasNextPage={false} />,
};
