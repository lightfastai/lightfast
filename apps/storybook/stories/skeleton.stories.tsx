import { Skeleton } from "@repo/ui-v2/components/ui/skeleton";
import type { Meta, StoryObj } from "@storybook/react-vite";

/**
 * Shows a placeholder while content is loading.
 */
const meta = {
  title: "ui/Skeleton",
  component: Skeleton,
  tags: ["autodocs"],
  parameters: {
    layout: "centered",
  },
} satisfies Meta<typeof Skeleton>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: (args) => (
    <div className="flex w-80 items-center gap-4">
      <Skeleton {...args} className="size-12 rounded-full" />
      <div className="flex-1 space-y-2">
        <Skeleton {...args} className="h-4 w-full" />
        <Skeleton {...args} className="h-4 w-2/3" />
      </div>
    </div>
  ),
};

export const Card: Story = {
  render: (args) => (
    <div className="w-80 space-y-4 rounded-2xl border p-4">
      <Skeleton {...args} className="h-40 w-full" />
      <div className="space-y-2">
        <Skeleton {...args} className="h-4 w-3/4" />
        <Skeleton {...args} className="h-4 w-1/2" />
      </div>
    </div>
  ),
};
