import type { Meta, StoryObj } from "@storybook/react";
import { ImageUpload } from "./ImageUpload";

const meta: Meta<typeof ImageUpload> = {
  title: "Admin/ImageUpload",
  component: ImageUpload,
  parameters: { auth: "admin" },
  decorators: [(Story) => <div className="max-w-sm"><Story /></div>],
};

export default meta;
type Story = StoryObj<typeof ImageUpload>;

export const NoImage: Story = {
  args: {
    entityType: "show",
    entityId: "show-1",
    currentImageUrl: null,
    onUploaded: (url) => alert(`uploaded: ${url}`),
  },
};

export const WithImage: Story = {
  args: {
    entityType: "show",
    entityId: "show-1",
    currentImageUrl: "https://picsum.photos/seed/admin-upload/300/200",
    onUploaded: (url) => alert(`uploaded: ${url}`),
  },
};

export const CustomLabel: Story = {
  args: {
    entityType: "venue",
    entityId: "venue-1",
    currentImageUrl: null,
    onUploaded: (url) => alert(`uploaded: ${url}`),
    label: "Venue photo",
  },
};
