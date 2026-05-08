import type { Meta, StoryObj } from "@storybook/react";
import { PersonSearchInput } from "./PersonSearchInput";

const meta: Meta<typeof PersonSearchInput> = {
  title: "Forms/PersonSearchInput",
  component: PersonSearchInput,
  decorators: [(Story) => <div className="max-w-md"><Story /></div>],
};

export default meta;
type Story = StoryObj<typeof PersonSearchInput>;

export const Default: Story = {
  args: {
    onSelect: (p) => alert(`Selected: ${p?.name ?? "none"}`),
    onNewName: (n) => alert(`New name: ${n}`),
  },
};
