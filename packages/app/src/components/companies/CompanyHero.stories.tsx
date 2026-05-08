import type { Meta, StoryObj } from "@storybook/react";
import { CompanyHero } from "./CompanyHero";

const meta: Meta<typeof CompanyHero> = {
  title: "Organisms/CompanyHero",
  component: CompanyHero,
  parameters: { layout: "padded" },
};

export default meta;
type Story = StoryObj<typeof CompanyHero>;

export const WithLogo: Story = {
  args: {
    name: "The Public Theater",
    description:
      "Founded in 1954, The Public Theater has a singular mission to produce a canon of original work and develop new plays and musicals. We believe theater is an essential cultural force that serves the public good through its impact on individual lives and communities.",
    logoUrl: "https://picsum.photos/seed/company-logo/160/160",
  },
};

export const NoLogo: Story = {
  args: {
    name: "New Ohio Theatre",
    description: "Off-Off-Broadway venue dedicated to experimental work.",
    logoUrl: null,
  },
};

export const NoDescription: Story = {
  args: {
    name: "Signature Theatre Company",
    description: null,
    logoUrl: null,
  },
};
