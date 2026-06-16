import {
  AiBrain02Icon,
  Attachment02Icon,
  Mail01Icon,
  Search02Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
  InputGroupText,
  InputGroupTextarea,
} from "@repo/ui-v2/components/ui/input-group";
import type { Meta, StoryObj } from "@storybook/react-vite";

/**
 * Combines input controls with inline or stacked addons.
 */
const meta = {
  title: "ui/InputGroup",
  component: InputGroup,
  tags: ["autodocs"],
  render: (args) => (
    <InputGroup {...args} className="w-96">
      <InputGroupAddon>
        <HugeiconsIcon aria-hidden="true" icon={Search02Icon} size={16} />
      </InputGroupAddon>
      <InputGroupInput placeholder="Search runs" />
      <InputGroupAddon align="inline-end">
        <kbd>K</kbd>
      </InputGroupAddon>
    </InputGroup>
  ),
  parameters: {
    layout: "centered",
  },
} satisfies Meta<typeof InputGroup>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithButton: Story = {
  render: (args) => (
    <InputGroup {...args} className="w-96">
      <InputGroupAddon>
        <HugeiconsIcon aria-hidden="true" icon={Mail01Icon} size={16} />
      </InputGroupAddon>
      <InputGroupInput placeholder="teammate@lightfast.ai" type="email" />
      <InputGroupAddon align="inline-end">
        <InputGroupButton>Invite</InputGroupButton>
      </InputGroupAddon>
    </InputGroup>
  ),
};

export const WithText: Story = {
  render: (args) => (
    <InputGroup {...args} className="w-96">
      <InputGroupAddon>
        <InputGroupText>
          <HugeiconsIcon aria-hidden="true" icon={AiBrain02Icon} size={16} />
          Model
        </InputGroupText>
      </InputGroupAddon>
      <InputGroupInput defaultValue="lightfast/default" />
    </InputGroup>
  ),
};

export const WithTextarea: Story = {
  render: (args) => (
    <InputGroup {...args} className="w-[420px]">
      <InputGroupTextarea
        defaultValue="Draft a concise summary of the latest agent run."
        rows={3}
      />
      <InputGroupAddon align="block-end" className="justify-between">
        <InputGroupText>
          <HugeiconsIcon aria-hidden="true" icon={Attachment02Icon} size={16} />
          2 files
        </InputGroupText>
        <InputGroupButton>Send</InputGroupButton>
      </InputGroupAddon>
    </InputGroup>
  ),
};

export const Invalid: Story = {
  render: (args) => (
    <InputGroup {...args} className="w-96">
      <InputGroupInput
        aria-invalid="true"
        defaultValue="not-an-email"
        type="email"
      />
      <InputGroupAddon align="inline-end">
        <InputGroupText>Invalid</InputGroupText>
      </InputGroupAddon>
    </InputGroup>
  ),
};
