import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { RelationPicker } from "./RelationPicker";

const meta: Meta<typeof RelationPicker> = {
  title: "Admin/RelationPicker",
  component: RelationPicker,
  parameters: { auth: "admin" },
  decorators: [(Story) => <div className="p-6 max-w-md"><Story /></div>],
};

export default meta;
type Story = StoryObj<typeof RelationPicker>;

const venueOptions = [
  { id: "v1", label: "Richard Rodgers Theatre", sublabel: "New York" },
  { id: "v2", label: "Hudson Theatre", sublabel: "New York" },
  { id: "v3", label: "Carnegie Hall", sublabel: "New York" },
  { id: "v4", label: "BAM", sublabel: "Brooklyn" },
];

function SingleStateful() {
  const [value, setValue] = useState<string | null>(null);
  return (
    <RelationPicker
      label="Venue"
      multi={false}
      value={value}
      onChange={setValue}
      options={venueOptions}
      onSearch={(q) => console.log(`Search: ${q}`)}
      placeholder="Search venues..."
    />
  );
}

function MultiStateful() {
  const [value, setValue] = useState<string[]>([]);
  return (
    <RelationPicker
      label="Venues"
      multi={true}
      value={value}
      onChange={setValue}
      options={venueOptions}
      onSearch={(q) => console.log(`Search: ${q}`)}
      placeholder="Search venues..."
    />
  );
}

export const Single: Story = {
  render: () => <SingleStateful />,
};

export const Multi: Story = {
  render: () => <MultiStateful />,
};

export const Loading: Story = {
  render: () => (
    <RelationPicker
      label="Venue"
      multi={false}
      value={null}
      onChange={() => {}}
      options={[]}
      loading={true}
    />
  ),
};
