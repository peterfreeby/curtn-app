import type { Meta, StoryObj } from "@storybook/react";
import { PerformanceGrid } from "./PerformanceGrid";

const meta: Meta<typeof PerformanceGrid> = {
  title: "Organisms/PerformanceGrid",
  component: PerformanceGrid,
  parameters: { layout: "padded" },
};

export default meta;
type Story = StoryObj<typeof PerformanceGrid>;

const performances = [
  {
    id: "p1",
    title: "Hamilton",
    performanceTypes: ["Musical"],
    company: { name: "Public Theater" },
    averageRating: 4.7,
    reviewCount: 128,
    upcomingPerformances: [{ date: "2026-04-20" }, { date: "2026-04-21" }],
  },
  {
    id: "p2",
    title: "Death of a Salesman",
    performanceTypes: ["Drama"],
    company: { name: "Roundabout" },
    averageRating: 4.2,
    reviewCount: 42,
    upcomingPerformances: null,
  },
  {
    id: "p3",
    title: "The Book of Mormon",
    performanceTypes: ["Musical", "Comedy"],
    company: { name: "Casey Nicholaw" },
    averageRating: 4.8,
    reviewCount: 512,
    upcomingPerformances: [{ date: "2026-04-22" }],
  },
  {
    id: "p4",
    title: "Waiting for Godot",
    performanceTypes: ["Drama"],
    company: { name: "Theatre for a New Audience" },
    averageRating: null,
    reviewCount: 0,
    upcomingPerformances: null,
  },
  {
    id: "p5",
    title: "Macbeth",
    performanceTypes: ["Drama"],
    company: { name: "Royal Shakespeare Company" },
    averageRating: 4.2,
    reviewCount: 54,
    upcomingPerformances: [{ date: "2026-05-01" }],
  },
  {
    id: "p6",
    title: "Our Town",
    performanceTypes: ["Drama"],
    company: { name: "Barrymore" },
    averageRating: 4.0,
    reviewCount: 18,
    upcomingPerformances: null,
  },
];

export const Populated: Story = {
  args: { performances, loading: false },
};

export const Loading: Story = {
  args: { performances: [], loading: true },
};

export const Empty: Story = {
  args: { performances: [], loading: false },
};
