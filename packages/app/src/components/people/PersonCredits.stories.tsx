import type { Meta, StoryObj } from "@storybook/react";
import { PersonCredits } from "./PersonCredits";

const meta: Meta<typeof PersonCredits> = {
  title: "Organisms/PersonCredits",
  component: PersonCredits,
  decorators: [(Story) => <div className="max-w-2xl"><Story /></div>],
};

export default meta;
type Story = StoryObj<typeof PersonCredits>;

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

export const Full: Story = {
  args: {
    showCredits: [showCredit("1", "Writer", "Hamilton")],
    castCredits: [
      runCredit("c1", "Alexander Hamilton", "Hamilton", "2015-08-06", "2016-07-09"),
      runCredit("c2", "Usnavi", "In the Heights", "2008-03-09", "2011-01-09"),
    ],
    crewCredits: [
      runCredit("cw1", "Music Supervisor", "Freestyle Love Supreme", "2019-10-02", "2020-01-12"),
    ],
  },
};

export const Empty: Story = {
  args: { showCredits: [], castCredits: [], crewCredits: [] },
};
