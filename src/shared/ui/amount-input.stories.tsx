"use client";

import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useState } from "react";
import { AmountInput } from "./amount-input";

const meta = {
  title: "UI/AmountInput",
  component: AmountInput,
  parameters: { layout: "centered" },
  args: { value: "", onChange: () => {} },
  decorators: [
    (Story) => (
      <div className="w-56 mt-4">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof AmountInput>;

export default meta;
type Story = StoryObj<typeof meta>;

function Controlled({ currency, initialValue = "" }: { currency?: string; initialValue?: string }) {
  const [value, setValue] = useState(initialValue);
  return <AmountInput value={value} onChange={setValue} currency={currency} />;
}

export const Default: Story = {
  render: () => <Controlled />,
};

export const WithCurrency: Story = {
  render: () => <Controlled currency="USD" />,
};

export const WithEuro: Story = {
  render: () => <Controlled currency="EUR" initialValue="42.50" />,
};

export const Disabled: Story = {
  args: { value: "100.00", onChange: () => {}, currency: "USD", disabled: true },
};
