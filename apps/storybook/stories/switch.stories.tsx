import { Switch } from "@repo/ui-v2/components/ui/switch";
import type { Meta, StoryObj } from "@storybook/react-vite";

/**
 * A control that allows the user to toggle between checked and unchecked.
 */
const meta = {
  title: "ui/Switch",
  component: Switch,
  tags: ["autodocs"],
  argTypes: {
    disabled: {
      control: "boolean",
    },
    size: {
      control: "radio",
      options: ["sm", "default"],
    },
  },
  args: {
    disabled: false,
    id: "airplane-mode",
    size: "default",
  },
  render: (args) => (
    <div className="flex items-center gap-2">
      <Switch {...args} />
      <label className="font-medium text-sm" htmlFor={args.id}>
        Airplane mode
      </label>
    </div>
  ),
  parameters: {
    layout: "centered",
  },
} satisfies Meta<typeof Switch>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Checked: Story = {
  args: {
    defaultChecked: true,
    id: "checked-switch",
  },
};

export const Disabled: Story = {
  args: {
    disabled: true,
    id: "disabled-switch",
  },
};

export const Small: Story = {
  args: {
    id: "small-switch",
    size: "sm",
  },
};
