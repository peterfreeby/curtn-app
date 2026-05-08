import type { Meta, StoryObj } from "@storybook/react";
import { BackdropHero } from "./BackdropHero";

const meta: Meta<typeof BackdropHero> = {
  title: "Organisms/BackdropHero",
  component: BackdropHero,
  parameters: { layout: "fullscreen" },
};

export default meta;
type Story = StoryObj<typeof BackdropHero>;

export const Default: Story = {
  args: {
    title: "Hamilton",
    subtitle: "Richard Rodgers Theatre",
    meta: "Broadway · Opened Aug 6, 2015",
    backdropUrl: "https://picsum.photos/seed/backdrop-hamilton/1400/400",
    posterUrl: "https://picsum.photos/seed/poster-hamilton/200/300",
  },
};

export const NoBackdrop: Story = {
  args: {
    title: "Waiting for Godot",
    subtitle: "Polonsky Shakespeare Center",
    meta: "Brooklyn, NY",
    posterUrl: "https://picsum.photos/seed/poster-godot/200/300",
  },
};

export const NoPoster: Story = {
  args: {
    title: "New Work-in-Progress",
    subtitle: "Experimental Workshop",
    backdropUrl: "https://picsum.photos/seed/backdrop-workshop/1400/400",
  },
};

export const WithChildren: Story = {
  args: {
    title: "The Book of Mormon",
    subtitle: "Eugene O'Neill Theatre",
    backdropUrl: "https://picsum.photos/seed/backdrop-bom/1400/400",
    posterUrl: "https://picsum.photos/seed/poster-bom/200/300",
    children: (
      <div className="mt-3 flex gap-2">
        <span className="bg-curtn-dark/60 px-2 py-0.5 text-[10px] uppercase tracking-wider text-curtn-muted">Musical</span>
        <span className="bg-curtn-dark/60 px-2 py-0.5 text-[10px] uppercase tracking-wider text-curtn-muted">Comedy</span>
      </div>
    ),
  },
};
