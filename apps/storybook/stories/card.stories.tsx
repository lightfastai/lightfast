import { MoreHorizontalIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Button } from "@repo/ui-v2/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@repo/ui-v2/components/ui/card";
import { Switch } from "@repo/ui-v2/components/ui/switch";
import type { Meta, StoryObj } from "@storybook/react-vite";

const notifications = [
  {
    title: "Agent run completed",
    description: "The workspace summary is ready to review.",
  },
  {
    title: "New connector request",
    description: "A teammate requested access to the GitHub connector.",
  },
  {
    title: "Budget threshold reached",
    description: "Usage is at 82% for the current billing cycle.",
  },
];

/**
 * Displays grouped content with optional header, action, content, and footer.
 */
const meta = {
  title: "ui/Card",
  component: Card,
  tags: ["autodocs"],
  argTypes: {
    size: {
      control: "radio",
      options: ["sm", "default"],
    },
  },
  args: {
    className: "w-[360px]",
    size: "default",
  },
  render: (args) => (
    <Card {...args}>
      <CardHeader>
        <CardTitle>Notifications</CardTitle>
        <CardDescription>You have 3 unread updates.</CardDescription>
        <CardAction>
          <Button aria-label="More options" size="icon-sm" variant="ghost">
            <HugeiconsIcon
              aria-hidden="true"
              icon={MoreHorizontalIcon}
              strokeWidth={2}
            />
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent className="space-y-4">
        {notifications.map((notification) => (
          <div className="flex gap-3" key={notification.title}>
            <span className="mt-1.5 size-2 rounded-full bg-primary" />
            <div className="space-y-1">
              <p className="font-medium">{notification.title}</p>
              <p className="text-muted-foreground">
                {notification.description}
              </p>
            </div>
          </div>
        ))}
      </CardContent>
      <CardFooter className="justify-between border-t">
        <span className="text-muted-foreground text-sm">Push alerts</span>
        <Switch aria-label="Enable push alerts" defaultChecked />
      </CardFooter>
    </Card>
  ),
  parameters: {
    layout: "centered",
  },
} satisfies Meta<typeof Card>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Compact: Story = {
  args: {
    size: "sm",
  },
};
