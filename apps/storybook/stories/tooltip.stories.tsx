import { AddIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Button } from "@repo/ui-v2/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@repo/ui-v2/components/ui/tooltip";
import type { Meta, StoryObj } from "@storybook/react-vite";

/**
 * Displays contextual information when a trigger receives hover or focus.
 */
const meta = {
  title: "ui/Tooltip",
  component: TooltipContent,
  tags: ["autodocs"],
  argTypes: {
    children: {
      control: "text",
    },
    side: {
      control: "radio",
      options: ["top", "right", "bottom", "left"],
    },
  },
  args: {
    children: "Create workspace",
    side: "top",
  },
  render: (args) => (
    <Tooltip>
      <TooltipTrigger render={<Button size="icon" variant="secondary" />}>
        <HugeiconsIcon aria-hidden="true" icon={AddIcon} strokeWidth={2} />
        <span className="sr-only">Create workspace</span>
      </TooltipTrigger>
      <TooltipContent {...args} />
    </Tooltip>
  ),
  parameters: {
    layout: "centered",
  },
} satisfies Meta<typeof TooltipContent>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Bottom: Story = {
  args: {
    side: "bottom",
  },
};

export const Left: Story = {
  args: {
    side: "left",
  },
};

export const Right: Story = {
  args: {
    side: "right",
  },
};
