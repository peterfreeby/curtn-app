import type { Meta, StoryObj } from "@storybook/react";
import { PosterStrip } from "./PosterStrip";
import { PosterCard } from "./PosterCard";

const meta: Meta<typeof PosterStrip> = {
  title: "Molecules/PosterStrip",
  component: PosterStrip,
};

export default meta;
type Story = StoryObj<typeof PosterStrip>;

const SAMPLES = [
  { title: "Hamilton", subtitle: "Richard Rodgers" },
  { title: "Death of a Salesman", subtitle: "Hudson" },
  { title: "The Book of Mormon", subtitle: "Eugene O'Neill" },
  { title: "Waiting for Godot", subtitle: "Polonsky Shakespeare" },
  { title: "Macbeth", subtitle: "Lincoln Center" },
  { title: "Our Town", subtitle: "Barrymore" },
];

export const WithTitle: Story = {
  args: {
    title: "Watchlist",
    children: SAMPLES.map((s, i) => (
      <PosterCard
        key={i}
        imageUrl={`https://picsum.photos/seed/strip-${i}/300/475`}
        title={s.title}
        subtitle={s.subtitle}
        size="sm"
      />
    )),
  },
};

export const NoTitle: Story = {
  args: {
    children: SAMPLES.map((s, i) => (
      <PosterCard key={i} title={s.title} subtitle={s.subtitle} size="sm" />
    )),
  },
};

export const Empty: Story = {
  args: { title: "No shows yet", children: <p className="text-xs text-curtn-muted">Start adding shows to see them here.</p> },
};
