import type { Meta, StoryObj } from "@storybook/react";
import { TemplatePreviewTable } from "./TemplatePreviewTable";

const meta: Meta<typeof TemplatePreviewTable> = {
  title: "Admin/TemplatePreviewTable",
  component: TemplatePreviewTable,
  parameters: { auth: "admin", layout: "padded" },
};

export default meta;
type Story = StoryObj<typeof TemplatePreviewTable>;

export const WithEvents: Story = {
  args: {
    events: [
      {
        showTitle: "Hamilton",
        venueName: "Richard Rodgers Theatre",
        date: "2026-04-15",
        time: "19:00",
        ticketUrl: "https://example.com/tickets/1",
      },
      {
        showTitle: "Hamilton",
        venueName: "Richard Rodgers Theatre",
        date: "2026-04-16",
        time: "20:00",
        ticketUrl: "https://example.com/tickets/2",
      },
    ] as any[],
  },
};

export const Empty: Story = {
  args: { events: [] },
};
