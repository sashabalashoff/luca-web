import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Card } from "./card";

const meta = {
  title: "UI/Card",
  component: Card,
  parameters: { layout: "centered" },
  args: { children: null },
} satisfies Meta<typeof Card>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    children: (
      <div className="p-4">
        <p className="text-sm font-medium">Card title</p>
        <p className="text-xs text-[rgb(var(--muted))] mt-1">Card content goes here</p>
      </div>
    ),
  },
};

export const WithPadding: Story = {
  render: () => (
    <div className="w-80 space-y-3">
      <Card className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-[rgb(var(--muted))]">Monthly income</p>
            <p className="text-xl font-semibold mt-0.5">$4,250.00</p>
          </div>
          <span className="text-xs text-[rgb(var(--positive))] bg-[rgb(var(--positive-dim))] px-2 py-0.5 rounded-full">+12%</span>
        </div>
      </Card>
      <Card className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-[rgb(var(--muted))]">Monthly expenses</p>
            <p className="text-xl font-semibold mt-0.5">$2,840.00</p>
          </div>
          <span className="text-xs text-[rgb(var(--negative))] bg-[rgb(var(--negative-dim))] px-2 py-0.5 rounded-full">-5%</span>
        </div>
      </Card>
      <Card className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-[rgb(var(--muted))]">Net savings</p>
            <p className="text-xl font-semibold mt-0.5">$1,410.00</p>
          </div>
          <span className="text-xs text-[rgb(var(--muted))] bg-[rgb(var(--surface-soft))] px-2 py-0.5 rounded-full">33%</span>
        </div>
      </Card>
    </div>
  ),
};
