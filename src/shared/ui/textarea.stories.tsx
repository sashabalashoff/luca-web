import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Textarea } from "./textarea";

const meta = {
  title: "UI/Textarea",
  component: Textarea,
  parameters: { layout: "centered" },
  decorators: [
    (Story) => (
      <div className="w-80">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof Textarea>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: { placeholder: "Add a note...", rows: 3 },
};

export const WithValue: Story = {
  args: { defaultValue: "Dinner with colleagues at Italian restaurant.", rows: 3 },
};

export const Disabled: Story = {
  args: { placeholder: "Disabled", disabled: true, rows: 3 },
};
