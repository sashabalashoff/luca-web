import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Button } from "./button";

const meta = {
  title: "UI/Button",
  component: Button,
  parameters: { layout: "centered" },
  argTypes: {
    variant: { control: "select", options: ["primary", "secondary", "ghost", "danger"] },
    size: { control: "select", options: ["sm", "md"] },
    disabled: { control: "boolean" },
    children: { control: "text" },
  },
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Primary: Story = {
  args: { children: "Save changes", variant: "primary" },
};

export const Secondary: Story = {
  args: { children: "Cancel", variant: "secondary" },
};

export const Ghost: Story = {
  args: { children: "Learn more", variant: "ghost" },
};

export const Danger: Story = {
  args: { children: "Delete", variant: "danger" },
};

export const Small: Story = {
  args: { children: "Small button", size: "sm" },
};

export const Disabled: Story = {
  args: { children: "Disabled", disabled: true },
};

export const AllVariants: Story = {
  render: () => (
    <div className="flex flex-col gap-4">
      <div className="flex gap-3 items-center">
        <Button variant="primary">Primary</Button>
        <Button variant="secondary">Secondary</Button>
        <Button variant="ghost">Ghost</Button>
        <Button variant="danger">Danger</Button>
      </div>
      <div className="flex gap-3 items-center">
        <Button size="sm" variant="primary">Primary sm</Button>
        <Button size="sm" variant="secondary">Secondary sm</Button>
        <Button size="sm" variant="ghost">Ghost sm</Button>
        <Button size="sm" variant="danger">Danger sm</Button>
      </div>
      <div className="flex gap-3 items-center">
        <Button disabled variant="primary">Disabled primary</Button>
        <Button disabled variant="secondary">Disabled secondary</Button>
      </div>
    </div>
  ),
};
