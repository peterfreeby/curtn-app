import type { Meta, StoryObj } from "@storybook/react";
import { CreditRow } from "./CreditRow";

const meta: Meta<typeof CreditRow> = {
  title: "Molecules/CreditRow",
  component: CreditRow,
  decorators: [(Story) => <div className="max-w-xl"><Story /></div>],
};

export default meta;
type Story = StoryObj<typeof CreditRow>;

export const WithHeadshot: Story = {
  args: {
    index: 1,
    personName: "Lin-Manuel Miranda",
    personSlug: "lin-manuel-miranda",
    role: "Alexander Hamilton",
    headshotUrl: "https://i.pravatar.cc/80?img=8",
  },
};

export const NoHeadshot: Story = {
  args: {
    index: 2,
    personName: "Leslie Odom Jr.",
    personSlug: "leslie-odom-jr",
    role: "Aaron Burr",
  },
};

export const List: Story = {
  render: () => (
    <div>
      <CreditRow index={1} personName="Lin-Manuel Miranda" personSlug="lin-manuel-miranda" role="Alexander Hamilton" headshotUrl="https://i.pravatar.cc/80?img=8" />
      <CreditRow index={2} personName="Leslie Odom Jr." personSlug="leslie-odom-jr" role="Aaron Burr" headshotUrl="https://i.pravatar.cc/80?img=15" />
      <CreditRow index={3} personName="Phillipa Soo" personSlug="phillipa-soo" role="Eliza Hamilton" />
      <CreditRow index={4} personName="Renée Elise Goldsberry" personSlug="renee-elise-goldsberry" role="Angelica Schuyler" headshotUrl="https://i.pravatar.cc/80?img=20" />
    </div>
  ),
};
