import { Textarea } from "@repo/ui-v2/components/ui/textarea";
import type { Meta, StoryObj } from "@storybook/react-vite";

/**
 * Displays a multiline text input.
 */
const meta = {
  title: "ui/Textarea",
  component: Textarea,
  tags: ["autodocs"],
  argTypes: {
    disabled: {
      control: "boolean",
    },
    placeholder: {
      control: "text",
    },
  },
  args: {
    className: "w-96",
    disabled: false,
    placeholder: "Ask Lightfast to inspect this run...",
  },
  parameters: {
    layout: "centered",
  },
} satisfies Meta<typeof Textarea>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithValue: Story = {
  args: {
    defaultValue:
      "Review the latest trace and call out the first failing tool result.",
  },
};

export const Disabled: Story = {
  args: {
    disabled: true,
    defaultValue: "This prompt is locked while the run is streaming.",
  },
};

export const Invalid: Story = {
  args: {
    "aria-invalid": true,
    defaultValue: "No target thread selected.",
  },
};
