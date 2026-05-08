import type { Meta, StoryObj } from "@storybook/react";
import { ShowCard } from "./ShowCard";

const meta: Meta<typeof ShowCard> = {
  title: "Molecules/ShowCard",
  component: ShowCard,
  decorators: [(Story) => <div className="max-w-xs"><Story /></div>],
};

export default meta;
type Story = StoryObj<typeof ShowCard>;

export const Default: Story = {
  args: {
    id: "s1",
    title: "Hamilton",
    performanceTypes: ["Musical"],
    companyName: "Public Theater",
    averageRating: 4.7,
    reviewCount: 186,
  },
};

export const NoRatings: Story = {
  args: {
    id: "s2",
    title: "A Midsummer Night's Dream",
    performanceTypes: ["Drama", "Classic"],
    companyName: "Shakespeare in the Park",
    averageRating: null,
    reviewCount: 0,
  },
};

export const NoCompany: Story = {
  args: {
    id: "s3",
    title: "Experimental Work in Progress",
    performanceTypes: ["Performance Art"],
    averageRating: 3.8,
    reviewCount: 4,
  },
};
