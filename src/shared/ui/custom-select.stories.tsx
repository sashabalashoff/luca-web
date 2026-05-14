"use client";

import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useState } from "react";
import { CustomSelect } from "./custom-select";

const meta = {
  title: "UI/CustomSelect",
  component: CustomSelect,
  parameters: { layout: "centered" },
  args: { value: "", onChange: () => {}, options: [] },
  decorators: [
    (Story) => (
      <div className="w-64 mt-4">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof CustomSelect>;

export default meta;
type Story = StoryObj<typeof meta>;

const CURRENCY_OPTIONS = [
  { value: "USD", label: "USD", description: "US Dollar" },
  { value: "EUR", label: "EUR", description: "Euro" },
  { value: "GBP", label: "GBP", description: "British Pound" },
  { value: "RUB", label: "RUB", description: "Russian Ruble" },
  { value: "KZT", label: "KZT", description: "Kazakhstani Tenge" },
];

const CATEGORY_OPTIONS = [
  { value: "food", label: "Food & Dining", description: "Restaurants, groceries" },
  { value: "transport", label: "Transport", description: "Taxi, public transit" },
  { value: "shopping", label: "Shopping", description: "Clothes, electronics" },
  { value: "health", label: "Health", description: "Pharmacy, gym" },
  { value: "entertainment", label: "Entertainment", description: "Movies, concerts" },
  { value: "utilities", label: "Utilities", description: "Electricity, internet" },
];

function Controlled({ options, searchable }: { options: typeof CURRENCY_OPTIONS; searchable?: boolean }) {
  const [value, setValue] = useState("");
  return (
    <CustomSelect
      value={value}
      onChange={setValue}
      options={options}
      placeholder="Select..."
      searchable={searchable}
    />
  );
}

export const Default: Story = {
  render: () => <Controlled options={CURRENCY_OPTIONS} />,
};

export const WithSearchable: Story = {
  render: () => <Controlled options={CURRENCY_OPTIONS} searchable />,
};

export const Categories: Story = {
  render: () => <Controlled options={CATEGORY_OPTIONS} />,
};

export const Disabled: Story = {
  args: {
    value: "USD",
    onChange: () => {},
    options: CURRENCY_OPTIONS,
    disabled: true,
  },
};

export const PreSelected: Story = {
  render: () => {
    const [value, setValue] = useState("EUR");
    return (
      <CustomSelect
        value={value}
        onChange={setValue}
        options={CURRENCY_OPTIONS}
        placeholder="Select currency"
        searchable
      />
    );
  },
};
