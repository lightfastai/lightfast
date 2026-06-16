import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@repo/ui-v2/components/ui/tabs";
import type { Meta, StoryObj } from "@storybook/react-vite";

/**
 * A set of layered sections that display one panel at a time.
 */
const meta = {
  title: "ui/Tabs",
  component: Tabs,
  tags: ["autodocs"],
  argTypes: {
    orientation: {
      control: "radio",
      options: ["horizontal", "vertical"],
    },
  },
  args: {
    className: "w-96",
    defaultValue: "overview",
    orientation: "horizontal",
  },
  render: (args) => (
    <Tabs {...args}>
      <TabsList>
        <TabsTrigger value="overview">Overview</TabsTrigger>
        <TabsTrigger value="runs">Runs</TabsTrigger>
        <TabsTrigger value="settings">Settings</TabsTrigger>
      </TabsList>
      <TabsContent className="rounded-2xl border p-4" value="overview">
        Review the current workspace health and the latest agent activity.
      </TabsContent>
      <TabsContent className="rounded-2xl border p-4" value="runs">
        Inspect queued, running, and completed agent runs.
      </TabsContent>
      <TabsContent className="rounded-2xl border p-4" value="settings">
        Configure routing, access, and notification preferences.
      </TabsContent>
    </Tabs>
  ),
  parameters: {
    layout: "centered",
  },
} satisfies Meta<typeof Tabs>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Line: Story = {
  render: (args) => (
    <Tabs {...args}>
      <TabsList variant="line">
        <TabsTrigger value="overview">Overview</TabsTrigger>
        <TabsTrigger value="runs">Runs</TabsTrigger>
        <TabsTrigger value="settings">Settings</TabsTrigger>
      </TabsList>
      <TabsContent className="pt-4" value="overview">
        The line variant reduces chrome for dense toolbars.
      </TabsContent>
      <TabsContent className="pt-4" value="runs">
        Active runs and historical runs share the same compact nav.
      </TabsContent>
      <TabsContent className="pt-4" value="settings">
        Settings can sit near adjacent form controls.
      </TabsContent>
    </Tabs>
  ),
};

export const Vertical: Story = {
  args: {
    className: "w-[480px]",
    orientation: "vertical",
  },
};
