import type { Meta, StoryObj } from "@storybook/react";
import { ListHeader } from "./ListHeader";

const meta: Meta<typeof ListHeader> = {
  title: "Organisms/ListHeader",
  component: ListHeader,
  parameters: { layout: "padded" },
};

export default meta;
type Story = StoryObj<typeof ListHeader>;

const owner = { username: "sarahk", fullName: "Sarah Kim", avatarUrl: "https://i.pravatar.cc/40?img=3" };

export const PublicOwner: Story = {
  args: {
    name: "Must-See 2026",
    description: "Everything I'm prioritizing this year — mostly Broadway and a few off-Broadway gems.",
    listType: "shows",
    isPublic: true,
    itemCount: 14,
    owner,
    collaborators: [],
    isOwner: true,
    isCollaborator: false,
    onEdit: () => alert("Edit"),
    onDelete: () => alert("Delete"),
  },
};

export const PublicViewer: Story = {
  args: {
    name: "Must-See 2026",
    description: "Everything I'm prioritizing this year.",
    listType: "shows",
    isPublic: true,
    itemCount: 14,
    owner,
    collaborators: [],
    isOwner: false,
    isCollaborator: false,
  },
};

export const PrivateOwner: Story = {
  args: {
    name: "Drafts",
    description: null,
    listType: "runs",
    isPublic: false,
    itemCount: 2,
    owner,
    collaborators: [],
    isOwner: true,
    isCollaborator: false,
    onEdit: () => alert("Edit"),
    onDelete: () => alert("Delete"),
  },
};

export const WithCollaborators: Story = {
  args: {
    name: "Brooklyn Spring Lineup",
    description: "Shared reconnaissance.",
    listType: "runs",
    isPublic: true,
    itemCount: 8,
    owner,
    collaborators: [
      { username: "marcust", fullName: "Marcus Torres" },
      { username: "lenar", fullName: "Lena Rivera" },
    ],
    isOwner: false,
    isCollaborator: true,
  },
};
