import type { Meta, StoryObj } from "@storybook/react";
import { CompanySearchInput } from "./CompanySearchInput";

const meta: Meta<typeof CompanySearchInput> = {
  title: "Forms/CompanySearchInput",
  component: CompanySearchInput,
  decorators: [(Story) => <div className="max-w-md"><Story /></div>],
};

export default meta;
type Story = StoryObj<typeof CompanySearchInput>;

export const Default: Story = {
  args: { onSelect: (c) => alert(`Selected: ${c.name}`) },
};

export const WithResults: Story = {
  args: { onSelect: (c) => alert(`Selected: ${c.name}`) },
  parameters: {
    urqlMockData: {
      SearchCompanies: {
        productionCompanyList: {
          edges: [
            { node: { id: "c1", name: "The Public Theater", slug: "the-public-theater" } },
            { node: { id: "c2", name: "Roundabout Theatre Company", slug: "roundabout" } },
            { node: { id: "c3", name: "New York Theatre Workshop", slug: "nytw" } },
          ],
        },
      },
    },
  },
};
