import {
  AddIcon,
  AiChat02Icon,
  BookOpen01Icon,
  Folder01Icon,
  HistoryIcon,
  Home01Icon,
  Mail01Icon,
  MoreHorizontalIcon,
  Search02Icon,
  SettingsIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react";
import { Avatar, AvatarFallback } from "@repo/ui-v2/components/ui/avatar";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupAction,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInput,
  SidebarInset,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSkeleton,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarProvider,
  SidebarRail,
  SidebarSeparator,
  SidebarTrigger,
} from "@repo/ui-v2/components/ui/sidebar";
import type { Meta, StoryObj } from "@storybook/react-vite";

interface NavItem {
  badge?: string;
  icon: IconSvgElement;
  label: string;
}

const navItems: NavItem[] = [
  { label: "Home", icon: Home01Icon },
  { label: "Threads", icon: AiChat02Icon, badge: "8" },
  { label: "Inbox", icon: Mail01Icon, badge: "3" },
  { label: "History", icon: HistoryIcon },
  { label: "Docs", icon: BookOpen01Icon },
];

const projects = ["Agent runtime", "Desktop shell", "Connectors"];

function SidebarStory({
  collapsible = "icon",
  defaultOpen = true,
  variant = "sidebar",
}: {
  collapsible?: React.ComponentProps<typeof Sidebar>["collapsible"];
  defaultOpen?: boolean;
  variant?: React.ComponentProps<typeof Sidebar>["variant"];
}) {
  const canCollapse = collapsible !== "none";

  return (
    <SidebarProvider
      className="min-h-[560px] overflow-hidden rounded-2xl border bg-background"
      defaultOpen={defaultOpen}
    >
      <Sidebar collapsible={collapsible} variant={variant}>
        <SidebarHeader>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton isActive size="lg">
                <div className="flex size-8 items-center justify-center rounded-xl bg-sidebar-primary text-sidebar-primary-foreground">
                  <HugeiconsIcon
                    aria-hidden="true"
                    icon={Folder01Icon}
                    strokeWidth={2}
                  />
                </div>
                <span>Lightfast</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
          <SidebarInput placeholder="Search" />
        </SidebarHeader>

        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>Workspace</SidebarGroupLabel>
            <SidebarGroupAction aria-label="Add item">
              <HugeiconsIcon
                aria-hidden="true"
                icon={AddIcon}
                strokeWidth={2}
              />
            </SidebarGroupAction>
            <SidebarGroupContent>
              <SidebarMenu>
                {navItems.map((item, index) => (
                  <SidebarMenuItem key={item.label}>
                    <SidebarMenuButton
                      isActive={index === 0}
                      tooltip={item.label}
                    >
                      <HugeiconsIcon
                        aria-hidden="true"
                        icon={item.icon}
                        strokeWidth={2}
                      />
                      <span>{item.label}</span>
                    </SidebarMenuButton>
                    {item.badge ? (
                      <SidebarMenuBadge>{item.badge}</SidebarMenuBadge>
                    ) : null}
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>

          <SidebarSeparator />

          <SidebarGroup>
            <SidebarGroupLabel>Projects</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {projects.map((project) => (
                  <SidebarMenuItem key={project}>
                    <SidebarMenuButton>
                      <HugeiconsIcon
                        aria-hidden="true"
                        icon={Folder01Icon}
                        strokeWidth={2}
                      />
                      <span>{project}</span>
                    </SidebarMenuButton>
                    <SidebarMenuAction aria-label="Project actions" showOnHover>
                      <HugeiconsIcon
                        aria-hidden="true"
                        icon={MoreHorizontalIcon}
                        strokeWidth={2}
                      />
                    </SidebarMenuAction>
                  </SidebarMenuItem>
                ))}
                <SidebarMenuItem>
                  <SidebarMenuButton>
                    <HugeiconsIcon
                      aria-hidden="true"
                      icon={SettingsIcon}
                      strokeWidth={2}
                    />
                    <span>Settings</span>
                  </SidebarMenuButton>
                  <SidebarMenuSub>
                    <SidebarMenuSubItem>
                      <SidebarMenuSubButton href="#">
                        Members
                      </SidebarMenuSubButton>
                    </SidebarMenuSubItem>
                    <SidebarMenuSubItem>
                      <SidebarMenuSubButton href="#">
                        Billing
                      </SidebarMenuSubButton>
                    </SidebarMenuSubItem>
                  </SidebarMenuSub>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>

          <SidebarGroup>
            <SidebarGroupLabel>Loading</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuSkeleton showIcon />
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuSkeleton />
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>

        <SidebarFooter>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton size="lg">
                <Avatar size="sm">
                  <AvatarFallback>JP</AvatarFallback>
                </Avatar>
                <div className="grid flex-1 text-left leading-tight">
                  <span className="truncate font-medium">Jeevan Pillay</span>
                  <span className="truncate text-muted-foreground text-xs">
                    jeevan@lightfast.ai
                  </span>
                </div>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
        {canCollapse ? <SidebarRail /> : null}
      </Sidebar>

      <SidebarInset>
        <header className="flex h-14 items-center gap-2 border-b px-4">
          {canCollapse ? <SidebarTrigger /> : null}
          <div className="flex items-center gap-2 text-muted-foreground text-sm">
            <HugeiconsIcon aria-hidden="true" icon={Search02Icon} size={16} />
            <span>Agent runs</span>
          </div>
        </header>
        <main className="grid flex-1 gap-4 p-4 md:grid-cols-3">
          <div className="rounded-2xl bg-muted/60 p-4">
            <p className="font-medium text-sm">Queued</p>
            <p className="mt-6 text-2xl">12</p>
          </div>
          <div className="rounded-2xl bg-muted/60 p-4">
            <p className="font-medium text-sm">Running</p>
            <p className="mt-6 text-2xl">4</p>
          </div>
          <div className="rounded-2xl bg-muted/60 p-4">
            <p className="font-medium text-sm">Completed</p>
            <p className="mt-6 text-2xl">128</p>
          </div>
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}

/**
 * A composable application sidebar with header, content, footer, and inset.
 */
const meta = {
  title: "ui/Sidebar",
  component: Sidebar,
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
  },
} satisfies Meta<typeof Sidebar>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => <SidebarStory />,
};

export const Collapsed: Story = {
  render: () => <SidebarStory defaultOpen={false} />,
};

export const Floating: Story = {
  render: () => <SidebarStory variant="floating" />,
};

export const Static: Story = {
  render: () => <SidebarStory collapsible="none" />,
};
