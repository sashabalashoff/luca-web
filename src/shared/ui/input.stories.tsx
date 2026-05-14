import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Input } from "./input";

const meta = {
  title: "UI/Input",
  component: Input,
  parameters: { layout: "centered" },
  decorators: [
    (Story) => (
      <div className="w-80">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof Input>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: { placeholder: "Enter text..." },
};

export const WithValue: Story = {
  args: { defaultValue: "Hello world" },
};

export const Disabled: Story = {
  args: { placeholder: "Disabled input", disabled: true },
};

export const TypeNumber: Story = {
  args: { type: "number", placeholder: "0.00" },
};

export const TypeEmail: Story = {
  args: { type: "email", placeholder: "you@example.com" },
};

export const TypePassword: Story = {
  args: { type: "password", defaultValue: "secret123" },
};
