import { Loading03Icon, Mail01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Button } from "@repo/ui-v2/components/ui/button";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect } from "storybook/test";

/**
 * Displays a button or a component that looks like a button.
 */
const meta = {
  title: "ui/Button",
  component: Button,
  tags: ["autodocs"],
  argTypes: {
    children: {
      control: "text",
    },
    size: {
      control: "radio",
      options: [
        "xs",
        "sm",
        "default",
        "lg",
        "icon-xs",
        "icon-sm",
        "icon",
        "icon-lg",
      ],
    },
    variant: {
      control: "radio",
      options: [
        "default",
        "outline",
        "secondary",
        "square",
        "ghost",
        "destructive",
        "link",
      ],
    },
  },
  parameters: {
    layout: "centered",
  },
  args: {
    variant: "default",
    size: "default",
    children: "Button",
  },
} satisfies Meta<typeof Button>;

export default meta;

type Story = StoryObj<typeof meta>;

/**
 * The default form of the button, used for primary actions and commands.
 */
export const Default: Story = {};

/**
 * Use the `outline` button to reduce emphasis on secondary actions, such as
 * canceling or dismissing a dialog.
 */
export const Outline: Story = {
  args: {
    variant: "outline",
  },
};

/**
 * Use the `ghost` button when an action should stay minimal and subtle.
 */
export const Ghost: Story = {
  args: {
    variant: "ghost",
  },
};

/**
 * Use the `secondary` button to call for less emphasized actions, styled to
 * complement the primary button while being less conspicuous.
 */
export const Secondary: Story = {
  args: {
    variant: "secondary",
  },
};

/**
 * Use the `square` button for compact square-ish controls in rails and menu
 * triggers.
 */
export const Square: Story = {
  args: {
    variant: "square",
  },
};

/**
 * Use the `destructive` button to indicate errors, alerts, or the need for
 * immediate attention.
 */
export const Destructive: Story = {
  args: {
    variant: "destructive",
  },
};

/**
 * Use the `link` button to reduce emphasis on tertiary actions, such as
 * hyperlink or navigation, providing a text-only interactive element.
 */
export const Link: Story = {
  args: {
    variant: "link",
  },
};

/**
 * Add the `disabled` prop to prevent interactions and add a loading indicator
 * to signify an in-progress action.
 */
export const Loading: Story = {
  render: (args) => (
    <Button {...args}>
      <HugeiconsIcon
        aria-hidden="true"
        className="mr-2 animate-spin"
        icon={Loading03Icon}
        size={16}
      />
      Button
    </Button>
  ),
  args: {
    ...Outline.args,
    disabled: true,
  },
};

/**
 * Add an icon element to enhance visual communication and provide additional
 * context for the action.
 */
export const WithIcon: Story = {
  render: (args) => (
    <Button {...args}>
      <HugeiconsIcon
        aria-hidden="true"
        className="mr-2"
        icon={Mail01Icon}
        size={16}
      />
      Login with Email Button
    </Button>
  ),
  args: {
    ...Secondary.args,
  },
};

/**
 * Use the `sm` size for a smaller button, suitable for interfaces needing
 * compact elements without sacrificing usability.
 */
export const Small: Story = {
  args: {
    size: "sm",
  },
};

/**
 * Use the `xs` size for the most compact text button.
 */
export const ExtraSmall: Story = {
  args: {
    size: "xs",
  },
};

/**
 * Use the `lg` size for a larger button, offering better visibility and easier
 * interaction for users.
 */
export const Large: Story = {
  args: {
    size: "lg",
  },
};

/**
 * Use the `icon` size for a button with only an icon.
 */
export const Icon: Story = {
  args: {
    ...Secondary.args,
    "aria-label": "Login with email",
    size: "icon",
    children: <HugeiconsIcon aria-hidden="true" icon={Mail01Icon} />,
  },
};

/**
 * Use compact icon sizes in dense toolbars and rails.
 */
export const IconSizes: Story = {
  render: () => (
    <div className="flex items-center gap-2">
      {(["icon-xs", "icon-sm", "icon", "icon-lg"] as const).map((size) => (
        <Button
          aria-label={`Login with email ${size}`}
          key={size}
          size={size}
          variant="secondary"
        >
          <HugeiconsIcon aria-hidden="true" icon={Mail01Icon} />
        </Button>
      ))}
    </div>
  ),
};

/**
 * Add the `disabled` prop to prevent interactions with the button.
 */
export const Disabled: Story = {
  args: {
    disabled: true,
  },
};

export const CssCheck: Story = {
  render: () => <Button>CSS check</Button>,
  play: async ({ canvas }) => {
    const button = canvas.getByRole("button", { name: /css check/i });

    await expect(getComputedStyle(button).height).toBe("32px");
  },
};
