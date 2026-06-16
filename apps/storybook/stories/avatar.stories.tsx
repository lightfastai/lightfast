import { Tick02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Avatar,
  AvatarBadge,
  AvatarFallback,
  AvatarGroup,
  AvatarGroupCount,
  AvatarImage,
} from "@repo/ui-v2/components/ui/avatar";
import type { Meta, StoryObj } from "@storybook/react-vite";

const primaryPerson = {
  name: "Jeevan Pillay",
  fallback: "JP",
  image: "https://github.com/shadcn.png",
};
const secondaryPerson = {
  name: "Ada Lovelace",
  fallback: "AL",
  image: "https://github.com/vercel.png",
};
const people = [
  primaryPerson,
  secondaryPerson,
  {
    name: "Grace Hopper",
    fallback: "GH",
    image: "https://github.com/github.png",
  },
];

/**
 * An image element with a fallback for representing a person, team, or agent.
 */
const meta = {
  title: "ui/Avatar",
  component: Avatar,
  tags: ["autodocs"],
  argTypes: {
    size: {
      control: "radio",
      options: ["sm", "default", "lg"],
    },
  },
  args: {
    size: "default",
  },
  render: (args) => (
    <Avatar {...args}>
      <AvatarImage alt={primaryPerson.name} src={primaryPerson.image} />
      <AvatarFallback>{primaryPerson.fallback}</AvatarFallback>
    </Avatar>
  ),
  parameters: {
    layout: "centered",
  },
} satisfies Meta<typeof Avatar>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Fallback: Story = {
  render: (args) => (
    <Avatar {...args}>
      <AvatarImage alt="Missing avatar" src="/missing-avatar.png" />
      <AvatarFallback>LF</AvatarFallback>
    </Avatar>
  ),
};

export const WithBadge: Story = {
  render: (args) => (
    <Avatar {...args} className="overflow-visible">
      <AvatarImage alt={secondaryPerson.name} src={secondaryPerson.image} />
      <AvatarFallback>{secondaryPerson.fallback}</AvatarFallback>
      <AvatarBadge>
        <HugeiconsIcon aria-hidden="true" icon={Tick02Icon} strokeWidth={2} />
      </AvatarBadge>
    </Avatar>
  ),
};

export const Group: Story = {
  render: () => (
    <AvatarGroup>
      {people.map((person) => (
        <Avatar key={person.name}>
          <AvatarImage alt={person.name} src={person.image} />
          <AvatarFallback>{person.fallback}</AvatarFallback>
        </Avatar>
      ))}
      <AvatarGroupCount>+4</AvatarGroupCount>
    </AvatarGroup>
  ),
};
