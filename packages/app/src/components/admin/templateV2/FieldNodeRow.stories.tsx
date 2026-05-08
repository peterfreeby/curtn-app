import type { Meta, StoryObj } from "@storybook/react";
import { FieldNodeRow } from "./FieldNodeRow";

const meta: Meta<typeof FieldNodeRow> = {
  title: "Admin/TemplateV2/FieldNodeRow",
  component: FieldNodeRow,
  parameters: { auth: "admin" },
  decorators: [(Story) => <div className="max-w-xl"><Story /></div>],
};

export default meta;
type Story = StoryObj<typeof FieldNodeRow>;

const baseHandlers = {
  onActivate: () => alert("activate"),
  onUpdate: (u: any) => alert(`update: ${JSON.stringify(u)}`),
  onDelete: () => alert("delete"),
};

const baseNode = {
  id: "n-1",
  type: "field" as const,
  csvField: "showTitle",
  selector: "h1.show-title",
  attribute: undefined,
  transform: undefined,
  regex: undefined,
};

export const Unmapped: Story = {
  args: {
    node: { ...baseNode, selector: "" },
    isActive: false,
    previewText: null,
    ...baseHandlers,
  },
};

export const Mapped: Story = {
  args: {
    node: baseNode,
    isActive: false,
    previewText: "Hamilton",
    ...baseHandlers,
  },
};

export const Active: Story = {
  args: {
    node: baseNode,
    isActive: true,
    previewText: "Hamilton",
    ...baseHandlers,
  },
};
