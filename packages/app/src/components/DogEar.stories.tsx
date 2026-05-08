import type { Meta, StoryObj } from "@storybook/react";
import { DogEar } from "./DogEar";

const meta: Meta<typeof DogEar> = {
  title: "Atoms/DogEar",
  component: DogEar,
  argTypes: {
    size: { control: "select", options: ["sm", "md", "lg"] },
    dark: { control: "boolean" },
  },
  decorators: [
    (Story) => (
      <div className="relative bg-curtn-surface p-6 w-48 h-48 border border-curtn-dark">
        <Story />
        <p className="text-xs text-curtn-muted mt-2">Corner fold</p>
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof DogEar>;

export const Default: Story = { args: { size: "md" } };
export const Small: Story = { args: { size: "sm" } };
export const Large: Story = { args: { size: "lg" } };
export const Dark: Story = { args: { size: "md", dark: true } };

export const AllSizes: Story = {
  render: () => (
    <div className="flex gap-4">
      {(["sm", "md", "lg"] as const).map((s) => (
        <div key={s} className="relative bg-curtn-surface w-32 h-32 border border-curtn-dark">
          <DogEar size={s} />
          <span className="absolute bottom-2 left-2 text-[10px] uppercase tracking-widest text-curtn-muted">{s}</span>
        </div>
      ))}
    </div>
  ),
};
