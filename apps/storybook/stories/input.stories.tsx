import { Button } from "@repo/ui-v2/components/ui/button";
import { Input } from "@repo/ui-v2/components/ui/input";
import type { Meta, StoryObj } from "@storybook/react-vite";

/**
 * Displays a form input field or a component that looks like an input field.
 */
const meta = {
  title: "ui/Input",
  component: Input,
  tags: ["autodocs"],
  argTypes: {
    disabled: {
      control: "boolean",
    },
    placeholder: {
      control: "text",
    },
    type: {
      control: "text",
    },
  },
  args: {
    className: "w-80",
    disabled: false,
    placeholder: "name@lightfast.ai",
    type: "email",
  },
  parameters: {
    layout: "centered",
  },
} satisfies Meta<typeof Input>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Disabled: Story = {
  args: {
    disabled: true,
  },
};

export const Invalid: Story = {
  args: {
    "aria-invalid": true,
    defaultValue: "not-an-email",
  },
};

export const WithLabel: Story = {
  render: (args) => (
    <div className="grid gap-1.5">
      <label className="font-medium text-sm" htmlFor="story-email">
        Email
      </label>
      <Input {...args} id="story-email" />
    </div>
  ),
};

export const WithHelperText: Story = {
  render: (args) => (
    <div className="grid gap-1.5">
      <label className="font-medium text-sm" htmlFor="story-email-helper">
        Email
      </label>
      <Input {...args} id="story-email-helper" />
      <p className="text-muted-foreground text-xs">
        Used for workspace invitations and account recovery.
      </p>
    </div>
  ),
};

export const WithButton: Story = {
  render: (args) => (
    <div className="flex w-96 items-center gap-2">
      <Input {...args} />
      <Button type="button">Invite</Button>
    </div>
  ),
};
