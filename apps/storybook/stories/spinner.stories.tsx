import { Button } from "@repo/ui-v2/components/ui/button";
import { Spinner } from "@repo/ui-v2/components/ui/spinner";
import type { Meta, StoryObj } from "@storybook/react-vite";

/**
 * Displays an animated loading indicator.
 */
const meta = {
  title: "ui/Spinner",
  component: Spinner,
  tags: ["autodocs"],
  args: {
    className: "size-5",
  },
  parameters: {
    layout: "centered",
  },
} satisfies Meta<typeof Spinner>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Sizes: Story = {
  render: () => (
    <div className="flex items-center gap-4">
      <Spinner className="size-3" />
      <Spinner className="size-4" />
      <Spinner className="size-6" />
      <Spinner className="size-8" />
    </div>
  ),
};

export const InButton: Story = {
  render: () => (
    <Button disabled variant="outline">
      <Spinner className="mr-2" />
      Loading
    </Button>
  ),
};
