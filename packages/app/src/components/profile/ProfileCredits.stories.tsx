import type { Meta, StoryObj } from "@storybook/react";
import { ProfileCredits } from "./ProfileCredits";

const meta: Meta<typeof ProfileCredits> = {
  title: "Organisms/Profile/ProfileCredits",
  component: ProfileCredits,
  decorators: [(Story) => <div className="max-w-2xl"><Story /></div>],
};

export default meta;
type Story = StoryObj<typeof ProfileCredits>;

const runCredit = (id: string, role: string, title: string, startDate: string, endDate: string) => ({
  id,
  role,
  run: {
    id: `run-${id}`,
    show: { id: `show-${id}`, title },
    productionCompany: { name: "The Public Theater", slug: "the-public-theater" },
    venues: [{ name: "Richard Rodgers Theatre", city: "New York" }],
    startDate,
    endDate,
  },
});

const showCredit = (id: string, role: string, title: string) => ({
  id,
  role,
  show: { id: `sc-${id}`, title },
});

export const FullCredits: Story = {
  args: {
    isOwnProfile: true,
    showCredits: [
      showCredit("1", "Writer", "Hamilton"),
      showCredit("2", "Director", "In the Heights"),
    ],
    castCredits: [
      runCredit("c1", "Alexander Hamilton", "Hamilton", "2015-08-06", "2016-07-09"),
      runCredit("c2", "Usnavi", "In the Heights", "2008-03-09", "2011-01-09"),
    ],
    crewCredits: [
      runCredit("cw1", "Assistant Director", "Freestyle Love Supreme", "2019-10-02", "2020-01-12"),
    ],
  },
};

export const CastOnly: Story = {
  args: {
    isOwnProfile: false,
    showCredits: [],
    castCredits: [
      runCredit("c1", "Lead", "Death of a Salesman", "2023-09-15", "2024-01-15"),
      runCredit("c2", "Ensemble", "A Chorus Line", "2022-04-01", "2022-08-01"),
    ],
    crewCredits: [],
  },
};

export const Empty: Story = {
  args: { isOwnProfile: true, castCredits: [], crewCredits: [], showCredits: [] },
};

export const EmptyOther: Story = {
  args: { isOwnProfile: false, castCredits: [], crewCredits: [], showCredits: [] },
};
