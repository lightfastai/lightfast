import { Separator } from "@repo/ui-v2/components/ui/separator";
import type { Meta, StoryObj } from "@storybook/react-vite";

/**
 * Visually or semantically separates content.
 */
const meta = {
  title: "ui/Separator",
  component: Separator,
  tags: ["autodocs"],
  argTypes: {
    orientation: {
      control: "radio",
      options: ["horizontal", "vertical"],
    },
  },
  parameters: {
    layout: "centered",
  },
} satisfies Meta<typeof Separator>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Horizontal: Story = {
  render: () => (
    <div className="w-80 space-y-3">
      <div>
        <p className="font-medium text-sm">Workspace</p>
        <p className="text-muted-foreground text-sm">Production agents</p>
      </div>
      <Separator />
      <div className="flex h-5 items-center gap-3 text-sm">
        <span>Overview</span>
        <span>Runs</span>
        <span>Settings</span>
      </div>
    </div>
  ),
};

export const Vertical: Story = {
  render: () => (
    <div className="flex h-8 items-center gap-3 text-sm">
      <span>Open</span>
      <Separator orientation="vertical" />
      <span>Running</span>
      <Separator orientation="vertical" />
      <span>Archived</span>
    </div>
  ),
};
