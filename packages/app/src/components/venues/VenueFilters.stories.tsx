import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { VenueFilters } from "./VenueFilters";

const meta: Meta<typeof VenueFilters> = {
  title: "Molecules/VenueFilters",
  component: VenueFilters,
  decorators: [(Story) => <div className="max-w-2xl"><Story /></div>],
};

export default meta;
type Story = StoryObj<typeof VenueFilters>;

function Stateful({ initialCity = "", initialType = "", initialSearch = "" }: {
  initialCity?: string;
  initialType?: string;
  initialSearch?: string;
}) {
  const [search, setSearch] = useState(initialSearch);
  const [city, setCity] = useState(initialCity);
  const [type, setType] = useState(initialType);
  return (
    <VenueFilters
      search={search}
      onSearchChange={setSearch}
      selectedCity={city}
      onCityChange={setCity}
      selectedType={type}
      onTypeChange={setType}
    />
  );
}

export const Default: Story = {
  render: () => <Stateful />,
};

export const CitySelected: Story = {
  render: () => <Stateful initialCity="NYC" />,
};

export const TypeSelected: Story = {
  render: () => <Stateful initialType="concert-hall" />,
};

export const WithSearch: Story = {
  render: () => <Stateful initialSearch="brooklyn" initialCity="NYC" initialType="theater" />,
};
