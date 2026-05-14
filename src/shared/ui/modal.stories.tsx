"use client";

import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useState } from "react";
import { Modal } from "./modal";
import { Button } from "./button";
import { Input } from "./input";

const meta = {
  title: "UI/Modal",
  component: Modal,
  parameters: { layout: "fullscreen" },
  args: { open: false, onClose: () => {}, children: null },
} satisfies Meta<typeof Modal>;

export default meta;
type Story = StoryObj<typeof meta>;

function WithToggle({ title, maxWidth, footer, children }: {
  title?: string;
  maxWidth?: "sm" | "md" | "lg";
  footer?: React.ReactNode;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="p-8">
      <Button onClick={() => setOpen(true)}>Open modal</Button>
      <Modal open={open} onClose={() => setOpen(false)} title={title} maxWidth={maxWidth} footer={footer}>
        {children}
      </Modal>
    </div>
  );
}

export const Default: Story = {
  render: () => (
    <WithToggle title="Add transaction">
      <div className="space-y-3">
        <div>
          <label className="text-xs text-[rgb(var(--muted))] mb-1 block">Amount</label>
          <Input type="number" placeholder="0.00" />
        </div>
        <div>
          <label className="text-xs text-[rgb(var(--muted))] mb-1 block">Merchant</label>
          <Input placeholder="e.g. Starbucks" />
        </div>
      </div>
    </WithToggle>
  ),
};

export const WithFooter: Story = {
  render: () => (
    <WithToggle
      title="Confirm deletion"
      maxWidth="sm"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary">Cancel</Button>
          <Button variant="danger">Delete</Button>
        </div>
      }
    >
      <p className="text-sm text-[rgb(var(--muted))]">
        Are you sure you want to delete this transaction? This action cannot be undone.
      </p>
    </WithToggle>
  ),
};

export const NoTitle: Story = {
  render: () => (
    <WithToggle>
      <p className="text-sm">Modal without a title bar. Click outside or press Escape to close.</p>
    </WithToggle>
  ),
};

export const Large: Story = {
  render: () => (
    <WithToggle title="Monthly report" maxWidth="lg">
      <div className="space-y-2">
        {Array.from({ length: 8 }, (_, i) => (
          <div key={i} className="flex justify-between text-sm py-1 border-b border-[rgb(var(--border-soft))]">
            <span className="text-[rgb(var(--muted))]">Category {i + 1}</span>
            <span className="font-medium">${(Math.random() * 1000).toFixed(2)}</span>
          </div>
        ))}
      </div>
    </WithToggle>
  ),
};
