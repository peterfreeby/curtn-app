import type { Meta, StoryObj } from "@storybook/react";
import { TemplateFieldRow } from "./TemplateFieldRow";

const meta: Meta<typeof TemplateFieldRow> = {
  title: "Admin/TemplateFieldRow",
  component: TemplateFieldRow,
  parameters: { auth: "admin" },
  decorators: [(Story) => <div className="max-w-xl"><Story /></div>],
};

export default meta;
type Story = StoryObj<typeof TemplateFieldRow>;

const baseHandlers = {
  onActivate: () => alert("activate"),
  onClear: () => alert("clear"),
  onUpdateRule: (rule: any) => alert(`update: ${JSON.stringify(rule)}`),
};

export const Unmapped: Story = {
  args: {
    fieldName: "showTitle",
    label: "Show Title",
    required: true,
    rule: undefined,
    isActive: false,
    previewText: null,
    ...baseHandlers,
  },
};

export const Mapped: Story = {
  args: {
    fieldName: "showTitle",
    label: "Show Title",
    required: true,
    rule: { selector: "h1.show-title", transform: "trim" },
    isActive: false,
    previewText: "Hamilton",
    ...baseHandlers,
  },
};

export const Active: Story = {
  args: {
    fieldName: "showTitle",
    label: "Show Title",
    required: true,
    rule: { selector: "h1.show-title" },
    isActive: true,
    previewText: "Hamilton",
    ancestors: [
      { selector: "body", textContent: "", tagName: "body", childCount: 5 },
      { selector: "main", textContent: "", tagName: "main", childCount: 3 },
    ],
    children: [],
    ...baseHandlers,
  },
};
