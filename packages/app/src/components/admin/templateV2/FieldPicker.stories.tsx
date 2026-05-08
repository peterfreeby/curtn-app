import type { Meta, StoryObj } from "@storybook/react";
import { FieldPicker } from "./FieldPicker";

const meta: Meta<typeof FieldPicker> = {
  title: "Admin/TemplateV2/FieldPicker",
  component: FieldPicker,
  parameters: { auth: "admin" },
  decorators: [(Story) => <div className="relative p-6 max-w-md"><Story /></div>],
};

export default meta;
type Story = StoryObj<typeof FieldPicker>;

export const Default: Story = {
  args: {
    usedFields: new Set<string>(),
    onSelect: (key) => alert(`selected ${key}`),
    onCancel: () => alert("cancel"),
  },
};

export const WithUsedFields: Story = {
  args: {
    usedFields: new Set(["showTitle", "venueName", "performanceDate"]),
    onSelect: (key) => alert(`selected ${key}`),
    onCancel: () => alert("cancel"),
  },
};
