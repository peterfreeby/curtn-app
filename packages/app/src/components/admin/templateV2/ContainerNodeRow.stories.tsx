import type { Meta, StoryObj } from "@storybook/react";
import { ContainerNodeRow } from "./ContainerNodeRow";

const meta: Meta<typeof ContainerNodeRow> = {
  title: "Admin/TemplateV2/ContainerNodeRow",
  component: ContainerNodeRow,
  parameters: { auth: "admin" },
  decorators: [(Story) => <div className="max-w-xl"><Story /></div>],
};

export default meta;
type Story = StoryObj<typeof ContainerNodeRow>;

const handlers = {
  onToggleExpand: () => alert("toggle"),
  onActivate: () => alert("activate"),
  onUpdate: (u: any) => alert(`update: ${JSON.stringify(u)}`),
  onDelete: () => alert("delete"),
};

const baseNode = {
  id: "c-1",
  type: "container" as const,
  selector: ".performance-row",
  label: "Performance row",
  children: [
    { type: "field" as const, id: "f-1", csvField: "performanceDate", selector: ".date" },
    { type: "field" as const, id: "f-2", csvField: "performanceTime", selector: ".time" },
  ],
};

export const Collapsed: Story = {
  args: {
    node: baseNode,
    isActive: false,
    isExpanded: false,
    children: null,
    ...handlers,
  },
};

export const Expanded: Story = {
  args: {
    node: baseNode,
    isActive: false,
    isExpanded: true,
    children: <div className="p-3 text-xs text-curtn-muted">Nested node content</div>,
    ...handlers,
  },
};

export const Active: Story = {
  args: {
    node: baseNode,
    isActive: true,
    isExpanded: true,
    children: <div className="p-3 text-xs text-curtn-muted">Nested node content</div>,
    ...handlers,
  },
};
