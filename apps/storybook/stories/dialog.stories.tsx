import { Button } from "@repo/ui-v2/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@repo/ui-v2/components/ui/dialog";
import { Input } from "@repo/ui-v2/components/ui/input";
import type { Meta, StoryObj } from "@storybook/react-vite";

/**
 * Displays a modal dialog over the application surface.
 */
const meta = {
  title: "ui/Dialog",
  component: DialogContent,
  tags: ["autodocs"],
  render: (args) => (
    <Dialog>
      <DialogTrigger render={<Button />}>Open dialog</DialogTrigger>
      <DialogContent {...args}>
        <DialogHeader>
          <DialogTitle>Create workspace</DialogTitle>
          <DialogDescription>
            Name the workspace and choose the initial visibility.
          </DialogDescription>
        </DialogHeader>
        <label className="grid gap-1.5 text-sm" htmlFor="dialog-workspace">
          <span className="font-medium">Workspace name</span>
          <Input
            defaultValue="Lightfast Labs"
            id="dialog-workspace"
            placeholder="Workspace name"
          />
        </label>
        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>
            Cancel
          </DialogClose>
          <Button type="button">Create</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  ),
  parameters: {
    layout: "centered",
  },
} satisfies Meta<typeof DialogContent>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Open: Story = {
  render: (args) => (
    <Dialog defaultOpen>
      <DialogContent {...args}>
        <DialogHeader>
          <DialogTitle>Open dialog</DialogTitle>
          <DialogDescription>
            This variant starts open for visual review and screenshots.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>Close</DialogClose>
          <Button type="button">Continue</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  ),
};

export const WithoutCloseButton: Story = {
  args: {
    showCloseButton: false,
  },
};
