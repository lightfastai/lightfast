import { Link, useLocation } from "@tanstack/react-router"
import { Home, Zap, Settings, Book, Terminal, Activity, ExternalLink } from "lucide-react"
import {
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
  SidebarMenuItem,
} from "~/components/ui/sidebar"

type NavigationItem = {
  title: string;
  href: string;
  icon: React.ComponentType<any>;
  active?: boolean;
  disabled?: boolean;
  external?: boolean;
};

type NavigationGroup = {
  title: string;
  items: NavigationItem[];
};

export function AppSidebar() {
  const location = useLocation()
  const currentPath = location.pathname

  const navigation: NavigationGroup[] = [
    {
      title: "Overview",
      items: [
        {
          title: "Home",
          href: "/",
          icon: Home,
          active: currentPath === "/",
        },
        {
          title: "Agents",
          href: "/agents",
          icon: Zap,
          active: currentPath === "/agents",
        },
      ],
    },
    {
      title: "Developer",
      items: [
        {
          title: "API Status",
          href: "/api/agents",
          icon: Activity,
          disabled: false,
          active: currentPath === "/api/agents",
        },
        {
          title: "Console",
          href: "#",
          icon: Terminal,
          disabled: true,
        },
      ],
    },
    {
      title: "Resources",
      items: [
        {
          title: "Documentation",
          href: "https://lightfast.ai/docs",
          icon: Book,
          external: true,
        },
        {
          title: "Settings",
          href: "#",
          icon: Settings,
          disabled: true,
        },
      ],
    },
  ]

  return (
    <Sidebar>
      <SidebarHeader>
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-yellow-400 to-orange-500">
            <Zap className="h-4 w-4 text-white" />
          </div>
          <div>
            <h2 className="text-lg font-semibold">Lightfast</h2>
            <p className="text-xs text-muted-foreground">CLI v0.2.1</p>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent>
        {navigation.map((group) => (
          <SidebarGroup key={group.title}>
            <SidebarGroupLabel>{group.title}</SidebarGroupLabel>
            <SidebarGroupContent>
              {group.items.map((item) => {
                const Icon = item.icon
                
                if (item.external) {
                  return (
                    <SidebarMenuItem key={item.title}>
                      <a
                        href={item.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 w-full"
                      >
                        <Icon className="h-4 w-4" />
                        <span>{item.title}</span>
                        <ExternalLink className="ml-auto h-3 w-3" />
                      </a>
                    </SidebarMenuItem>
                  )
                }

                if (item.disabled || item.href === "#") {
                  return (
                    <SidebarMenuItem
                      key={item.title}
                      disabled={true}
                      className="cursor-not-allowed"
                    >
                      <Icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </SidebarMenuItem>
                  )
                }

                return (
                  <Link
                    key={item.title}
                    to={item.href}
                    className="block"
                  >
                    <SidebarMenuItem
                      active={item.active}
                      disabled={item.disabled}
                    >
                      <Icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </SidebarMenuItem>
                  </Link>
                )
              })}
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter>
        <div className="rounded-lg border bg-card p-3">
          <p className="text-xs text-muted-foreground">
            {process.env.NODE_ENV === 'development' ? 'Development' : 'Production'} Mode
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Port: {typeof window !== 'undefined' ? window.location.port || '80' : '3000'}
          </p>
        </div>
      </SidebarFooter>
    </Sidebar>
  )
}