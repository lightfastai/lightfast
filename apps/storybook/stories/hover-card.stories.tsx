import { Button } from "@repo/ui-v2/components/ui/button";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@repo/ui-v2/components/ui/hover-card";
import type { Meta, StoryObj } from "@storybook/react-vite";

/**
 * Shows a preview when a user hovers or focuses a trigger.
 */
const meta = {
  title: "ui/HoverCard",
  component: HoverCardTrigger,
  tags: ["autodocs"],
  argTypes: {
    closeDelay: {
      control: "number",
    },
    delay: {
      control: "number",
    },
  },
  args: {
    closeDelay: 100,
    delay: 300,
  },
  render: (args) => (
    <HoverCard>
      <HoverCardTrigger {...args} render={<Button variant="link" />}>
        @lightfast
      </HoverCardTrigger>
      <HoverCardContent>
        <div className="space-y-2">
          <p className="font-medium">Lightfast</p>
          <p className="text-muted-foreground">
            Agent orchestration tools for fast-moving product teams.
          </p>
        </div>
      </HoverCardContent>
    </HoverCard>
  ),
  parameters: {
    layout: "centered",
  },
} satisfies Meta<typeof HoverCardTrigger>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Instant: Story = {
  args: {
    closeDelay: 0,
    delay: 0,
  },
};
