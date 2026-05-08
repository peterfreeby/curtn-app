import type { Meta, StoryObj } from "@storybook/react";
import { V2PreviewTable } from "./V2PreviewTable";

const meta: Meta<typeof V2PreviewTable> = {
  title: "Admin/TemplateV2/V2PreviewTable",
  component: V2PreviewTable,
  parameters: { auth: "admin", layout: "padded" },
};

export default meta;
type Story = StoryObj<typeof V2PreviewTable>;

export const WithRows: Story = {
  args: {
    rows: [
      {
        showTitle: "Hamilton",
        showUrl: "https://example.com/hamilton",
        showPosterUrl: "https://picsum.photos/seed/v2-1/60/90",
        venueName: "Richard Rodgers Theatre",
        performanceDate: "2026-04-15",
        performanceTime: "19:00",
        ticketUrl: "https://example.com/tickets/1",
      },
      {
        showTitle: "Hamilton",
        showUrl: "https://example.com/hamilton",
        showPosterUrl: "https://picsum.photos/seed/v2-2/60/90",
        venueName: "Richard Rodgers Theatre",
        performanceDate: "2026-04-16",
        performanceTime: "20:00",
        ticketUrl: "https://example.com/tickets/2",
      },
    ] as any[],
  },
};

export const Empty: Story = {
  args: { rows: [] },
};
