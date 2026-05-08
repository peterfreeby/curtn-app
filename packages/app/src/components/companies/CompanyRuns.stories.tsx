import type { Meta, StoryObj } from "@storybook/react";
import { CompanyRuns } from "./CompanyRuns";

const meta: Meta<typeof CompanyRuns> = {
  title: "Organisms/CompanyRuns",
  component: CompanyRuns,
  decorators: [(Story) => <div className="max-w-4xl"><Story /></div>],
};

export default meta;
type Story = StoryObj<typeof CompanyRuns>;

const run = (id: string, title: string, start: string, end: string, rating: number | null, reviews: number) => ({
  id,
  show: { id: `show-${id}`, title, performanceTypes: ["Musical"] },
  venues: [{ id: "v1", name: "Richard Rodgers Theatre", slug: "rr-theatre", city: "New York" }],
  startDate: start,
  endDate: end,
  averageRating: rating,
  reviewCount: reviews,
});

export const Populated: Story = {
  args: {
    companyName: "The Public Theater",
    companySlug: "the-public-theater",
    runs: [
      run("r1", "Hamilton", "2015-08-06", "2016-07-09", 4.9, 340),
      run("r2", "In the Heights", "2008-03-09", "2011-01-09", 4.6, 220),
      run("r3", "Fun Home", "2015-04-19", "2016-09-10", 4.5, 104),
    ],
  },
};

export const Empty: Story = {
  args: {
    companyName: "New Company",
    companySlug: "new-company",
    runs: [],
  },
};
