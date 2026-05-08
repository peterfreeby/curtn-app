import type { Meta, StoryObj } from "@storybook/react";
import { TemplateNodeTree } from "./TemplateNodeTree";

const meta: Meta<typeof TemplateNodeTree> = {
  title: "Admin/TemplateV2/TemplateNodeTree",
  component: TemplateNodeTree,
  parameters: { auth: "admin", layout: "padded" },
  decorators: [(Story) => <div className="max-w-2xl"><Story /></div>],
};

export default meta;
type Story = StoryObj<typeof TemplateNodeTree>;

const handlers = {
  onSetActive: (id: string | null) => alert(`active: ${id}`),
  onUpdateNode: () => alert("update"),
  onDeleteNode: (id: string) => alert(`delete ${id}`),
  onAddField: () => alert("add field"),
  onAddContainer: () => alert("add container"),
};

export const WithNodes: Story = {
  args: {
    nodes: [
      { id: "c-1", type: "container", selector: ".performances", label: "Performance list", children: [
        { id: "f-1", type: "field", csvField: "performanceDate", selector: ".date" },
        { id: "f-2", type: "field", csvField: "performanceTime", selector: ".time" },
        { id: "f-3", type: "field", csvField: "ticketUrl", selector: "a.tickets", attribute: "href" },
      ]},
      { id: "f-4", type: "field", csvField: "showTitle", selector: "h1" },
      { id: "f-5", type: "field", csvField: "venueName", selector: ".venue" },
    ] as any[],
    activeNodeId: null,
    previewTexts: {
      "f-1": "2026-04-15",
      "f-2": "19:00",
      "f-4": "Hamilton",
      "f-5": "Richard Rodgers Theatre",
    },
    ...handlers,
  },
};

export const Empty: Story = {
  args: {
    nodes: [],
    activeNodeId: null,
    previewTexts: {},
    ...handlers,
  },
};
