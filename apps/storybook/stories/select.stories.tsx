import {
  AiBrain02Icon,
  Database02Icon,
  Search02Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@repo/ui-v2/components/ui/select";
import type { Meta, StoryObj } from "@storybook/react-vite";

interface ModelOption {
  icon: IconSvgElement;
  label: string;
  value: string;
}

const models: ModelOption[] = [
  { label: "Lightfast Default", value: "default", icon: AiBrain02Icon },
  { label: "Research", value: "research", icon: Search02Icon },
  { label: "Data Analyst", value: "data", icon: Database02Icon },
];

/**
 * Displays a selectable list of options in an anchored popover.
 */
const meta = {
  title: "ui/Select",
  component: Select,
  tags: ["autodocs"],
  render: (args) => (
    <Select {...args} defaultValue="default">
      <SelectTrigger className="w-56">
        <SelectValue placeholder="Select model" />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          <SelectLabel>Models</SelectLabel>
          {models.map((model) => (
            <SelectItem key={model.value} value={model.value}>
              <HugeiconsIcon aria-hidden="true" icon={model.icon} size={16} />
              {model.label}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  ),
  parameters: {
    layout: "centered",
  },
} satisfies Meta<typeof Select>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Small: Story = {
  render: (args) => (
    <Select {...args} defaultValue="research">
      <SelectTrigger className="w-44" size="sm">
        <SelectValue placeholder="Select model" />
      </SelectTrigger>
      <SelectContent>
        {models.map((model) => (
          <SelectItem key={model.value} value={model.value}>
            {model.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  ),
};

export const Grouped: Story = {
  render: (args) => (
    <Select {...args} defaultValue="draft">
      <SelectTrigger className="w-56">
        <SelectValue placeholder="Select workflow" />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          <SelectLabel>Writing</SelectLabel>
          <SelectItem value="draft">Draft response</SelectItem>
          <SelectItem value="summarize">Summarize thread</SelectItem>
        </SelectGroup>
        <SelectSeparator />
        <SelectGroup>
          <SelectLabel>Operations</SelectLabel>
          <SelectItem value="triage">Triage queue</SelectItem>
          <SelectItem value="inspect">Inspect run</SelectItem>
        </SelectGroup>
      </SelectContent>
    </Select>
  ),
};

export const Disabled: Story = {
  render: (args) => (
    <Select {...args} defaultValue="default">
      <SelectTrigger className="w-56" disabled>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="default">Lightfast Default</SelectItem>
      </SelectContent>
    </Select>
  ),
};
