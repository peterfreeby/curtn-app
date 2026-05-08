import type { Meta, StoryObj } from "@storybook/react";
import { Input } from "./Input";

const meta: Meta<typeof Input> = {
  title: "Atoms/Input",
  component: Input,
  argTypes: {
    type: { control: "select", options: ["text", "email", "tel", "password", "number", "url"] },
    required: { control: "boolean" },
  },
};

export default meta;
type Story = StoryObj<typeof Input>;

export const Default: Story = {
  args: { label: "Full name", placeholder: "Jane Doe" },
};

export const WithValue: Story = {
  args: { label: "Username", value: "sarahk", placeholder: "your_username", onChange: () => {} },
};

export const Required: Story = {
  args: { label: "Email", type: "email", required: true, placeholder: "you@example.com" },
};

export const Phone: Story = {
  args: { label: "Phone number", type: "tel", placeholder: "+1 (555) 123-4567" },
};

export const AllTypes: Story = {
  render: () => (
    <div className="space-y-6 max-w-sm">
      <Input label="Full name" placeholder="Jane Doe" />
      <Input label="Email" type="email" placeholder="you@example.com" />
      <Input label="Phone number" type="tel" placeholder="+1 (555) 000-0000" />
      <Input label="Password" type="password" placeholder="••••••••" />
    </div>
  ),
};
