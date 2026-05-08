import type { Meta, StoryObj } from "@storybook/react";
import { PosterCard } from "./PosterCard";

const meta: Meta<typeof PosterCard> = {
  title: "Molecules/PosterCard",
  component: PosterCard,
  argTypes: {
    size: { control: "select", options: ["sm", "md", "lg"] },
  },
};

export default meta;
type Story = StoryObj<typeof PosterCard>;

const POSTER = "https://picsum.photos/seed/hamilton/300/475";

export const WithImage: Story = {
  args: {
    imageUrl: POSTER,
    title: "Hamilton",
    subtitle: "Richard Rodgers Theatre",
    size: "md",
  },
};

export const TextOnly: Story = {
  args: {
    title: "Death of a Salesman",
    subtitle: "Hudson Theatre",
    size: "md",
  },
};

export const LongTitleTextOnly: Story = {
  args: {
    title: "The Strange Undoing of Prudencia Hart",
    subtitle: "National Theatre of Scotland",
    size: "md",
  },
};

export const Small: Story = {
  args: { imageUrl: POSTER, title: "Hamilton", size: "sm" },
};

export const Large: Story = {
  args: { imageUrl: POSTER, title: "Hamilton", subtitle: "Richard Rodgers Theatre", size: "lg" },
};

export const WithCustomActions: Story = {
  args: {
    imageUrl: POSTER,
    title: "Hamilton",
    subtitle: "Richard Rodgers Theatre",
    actions: [
      { icon: "eye", activeIcon: "eye", active: true, label: "Seen" },
      { icon: "heart", activeIcon: "heart", active: true, label: "Love" },
      { icon: "list-plus", label: "Add to list" },
    ],
  },
};

export const SizeSpectrum: Story = {
  render: () => (
    <div className="flex items-end gap-6">
      <PosterCard imageUrl={POSTER} title="Hamilton" size="sm" />
      <PosterCard imageUrl={POSTER} title="Hamilton" size="md" />
      <PosterCard imageUrl={POSTER} title="Hamilton" size="lg" />
    </div>
  ),
};
