import { Button } from "@repo/ui-v2/components/ui/button";
import { Input } from "@repo/ui-v2/components/ui/input";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@repo/ui-v2/components/ui/sheet";
import type { Meta, StoryObj } from "@storybook/react-vite";

/**
 * Displays complementary content in a panel anchored to an edge.
 */
const meta = {
  title: "ui/Sheet",
  component: SheetContent,
  tags: ["autodocs"],
  argTypes: {
    side: {
      control: "radio",
      options: ["top", "right", "bottom", "left"],
    },
    motion: {
      control: "radio",
      options: ["subtle", "slide"],
    },
    size: {
      control: "radio",
      options: ["default", "wide"],
    },
    showCloseButton: {
      control: "boolean",
    },
  },
  args: {
    side: "right",
    motion: "subtle",
    size: "default",
    showCloseButton: true,
  },
  render: (args) => (
    <Sheet>
      <SheetTrigger render={<Button />}>Open sheet</SheetTrigger>
      <SheetContent {...args}>
        <SheetHeader>
          <SheetTitle>Create workspace</SheetTitle>
          <SheetDescription>
            Name the workspace and choose how the team should discover it.
          </SheetDescription>
        </SheetHeader>
        <div className="grid gap-4 px-6">
          <label className="grid gap-1.5 text-sm" htmlFor="workspace-name">
            <span className="font-medium">Workspace name</span>
            <Input
              defaultValue="Lightfast Labs"
              id="workspace-name"
              placeholder="Workspace name"
            />
          </label>
          <label className="grid gap-1.5 text-sm" htmlFor="workspace-slug">
            <span className="font-medium">Slug</span>
            <Input
              defaultValue="lightfast-labs"
              id="workspace-slug"
              placeholder="workspace-slug"
            />
          </label>
        </div>
        <SheetFooter>
          <SheetClose render={<Button variant="outline" />}>Cancel</SheetClose>
          <Button type="button">Create</Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  ),
  parameters: {
    layout: "centered",
  },
} satisfies Meta<typeof SheetContent>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Left: Story = {
  args: {
    side: "left",
  },
};

export const Slide: Story = {
  args: {
    motion: "slide",
  },
};

export const Wide: Story = {
  args: {
    size: "wide",
  },
};

export const WideSlide: Story = {
  args: {
    motion: "slide",
    size: "wide",
  },
};

export const Open: Story = {
  args: {
    motion: "slide",
    size: "wide",
  },
  render: (args) => (
    <Sheet defaultOpen>
      <SheetContent {...args}>
        <SheetHeader>
          <SheetTitle>Open sheet</SheetTitle>
          <SheetDescription>
            This variant starts open for visual review and screenshots.
          </SheetDescription>
        </SheetHeader>
        <div className="px-6 text-muted-foreground text-sm">
          The close button remains available in the top right corner.
        </div>
      </SheetContent>
    </Sheet>
  ),
};
