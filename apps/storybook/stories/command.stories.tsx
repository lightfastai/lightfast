import {
  AiBrain02Icon,
  CodeIcon,
  CommandLineIcon,
  Database02Icon,
  Search02Icon,
  SettingsIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react";
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@repo/ui-v2/components/ui/command";
import type { Meta, StoryObj } from "@storybook/react-vite";

interface CommandAction {
  icon: IconSvgElement;
  label: string;
  shortcut?: string;
}

const actions: CommandAction[] = [
  { label: "Search threads", icon: Search02Icon, shortcut: "S" },
  { label: "Open model settings", icon: AiBrain02Icon, shortcut: "M" },
  { label: "View data sources", icon: Database02Icon },
  { label: "Open developer console", icon: CodeIcon },
];

/**
 * Displays a command menu for searching and invoking application actions.
 */
const meta = {
  title: "ui/Command",
  component: Command,
  tags: ["autodocs"],
  render: (args) => (
    <Command {...args} className="w-[360px]">
      <CommandInput placeholder="Search commands..." />
      <CommandList>
        <CommandEmpty>No commands found.</CommandEmpty>
        <CommandGroup heading="Workspace">
          {actions.map((action) => (
            <CommandItem key={action.label} value={action.label}>
              <HugeiconsIcon aria-hidden="true" icon={action.icon} size={16} />
              <span>{action.label}</span>
              {action.shortcut ? (
                <CommandShortcut>{action.shortcut}</CommandShortcut>
              ) : null}
            </CommandItem>
          ))}
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="System">
          <CommandItem value="command palette">
            <HugeiconsIcon
              aria-hidden="true"
              icon={CommandLineIcon}
              size={16}
            />
            <span>Command palette</span>
          </CommandItem>
          <CommandItem value="preferences">
            <HugeiconsIcon aria-hidden="true" icon={SettingsIcon} size={16} />
            <span>Preferences</span>
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </Command>
  ),
  parameters: {
    layout: "centered",
  },
} satisfies Meta<typeof Command>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Empty: Story = {
  render: (args) => (
    <Command {...args} className="w-[360px]">
      <CommandInput placeholder="Search commands..." value="unknown command" />
      <CommandList>
        <CommandEmpty>No commands found.</CommandEmpty>
      </CommandList>
    </Command>
  ),
};

export const InDialog: Story = {
  render: (args) => (
    <CommandDialog defaultOpen title="Command Palette">
      <Command {...args}>
        <CommandInput placeholder="Search Lightfast..." />
        <CommandList>
          <CommandGroup heading="Suggested">
            {actions.slice(0, 3).map((action) => (
              <CommandItem key={action.label} value={action.label}>
                <HugeiconsIcon
                  aria-hidden="true"
                  icon={action.icon}
                  size={16}
                />
                <span>{action.label}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </Command>
    </CommandDialog>
  ),
};
