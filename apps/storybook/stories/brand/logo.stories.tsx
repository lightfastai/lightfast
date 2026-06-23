import { Logo } from "@repo/ui-v2/components/brand/logo";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect } from "storybook/test";

const LOGO_SIZE_OPTIONS = ["xs", "sm", "md", "lg", "xl"] as const;

const meta = {
  title: "Brand/Logo",
  component: Logo,
  tags: ["autodocs"],
  argTypes: {
    showWordmark: {
      control: "boolean",
    },
    size: {
      control: "radio",
      options: LOGO_SIZE_OPTIONS,
    },
    variant: {
      control: "radio",
      options: ["default", "muted", "inverse"],
    },
  },
  args: {
    showWordmark: true,
    size: "md",
    variant: "default",
  },
  parameters: {
    layout: "centered",
  },
} satisfies Meta<typeof Logo>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Sizes: Story = {
  render: () => (
    <div className="flex flex-col gap-5">
      {LOGO_SIZE_OPTIONS.map((size) => (
        <div className="flex items-center gap-6" key={size}>
          <span className="w-8 font-mono text-muted-foreground text-xs">
            {size}
          </span>
          <Logo size={size} />
        </div>
      ))}
    </div>
  ),
  play: async ({ canvas }) => {
    await expect(
      canvas.getAllByRole("img", { name: "Lightfast" })
    ).toHaveLength(LOGO_SIZE_OPTIONS.length);
  },
};

export const MarkOnly: Story = {
  args: {
    showWordmark: false,
  },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("img", { name: "Lightfast" })).toBeTruthy();
  },
};

export const Variants: Story = {
  render: () => (
    <div className="grid gap-3">
      <div className="rounded-lg border bg-background p-6">
        <Logo variant="default" />
      </div>
      <div className="rounded-lg border bg-background p-6">
        <Logo variant="muted" />
      </div>
      <div className="rounded-lg bg-black p-6">
        <Logo variant="inverse" />
      </div>
    </div>
  ),
};
