import type { Meta, StoryObj } from "@storybook/react";
import { EditProfileModal } from "./EditProfileModal";

const meta: Meta<typeof EditProfileModal> = {
  title: "Organisms/Profile/EditProfileModal",
  component: EditProfileModal,
  parameters: { layout: "fullscreen" },
};

export default meta;
type Story = StoryObj<typeof EditProfileModal>;

export const WithAvatar: Story = {
  args: {
    fullName: "Sarah Kim",
    bio: "Theater critic, arts writer, Brooklyn-based.",
    avatarUrl: "https://i.pravatar.cc/100?img=3",
    onClose: () => alert("close"),
    onSaved: () => alert("saved"),
  },
};

export const NoAvatar: Story = {
  args: {
    fullName: "Peter Freeby",
    bio: "",
    avatarUrl: "",
    onClose: () => alert("close"),
    onSaved: () => alert("saved"),
  },
};
