import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Settings } from "lucide-react";

import { Icons } from "@repo/ui/components/icons";
import { useTheme } from "@repo/ui/components/theme-provider";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@repo/ui/components/ui/avatar";
import { Button } from "@repo/ui/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@repo/ui/components/ui/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@repo/ui/components/ui/sidebar";
import { cn } from "@repo/ui/lib/utils";

import { ApiStatusIndicator } from "./connection-indicators/api-status-indicator";
import { BlenderStatusIndicator } from "./connection-indicators/blender-status-indicator";
import { SIDEBAR_TOGGLE_EVENT } from "./title-bar";
import ToggleTheme from "./toggle-theme";

function UserDropdown() {
  // const { user, signOut } = useAuth();
  const { theme, setTheme } = useTheme();
  const [isOpen, setIsOpen] = useState(false);

  const user = {
    email: "test@test.com",
  };

  // Close dropdown when sidebar is toggled
  useEffect(() => {
    const handleSidebarToggle = (event: Event) => {
      const customEvent = event as CustomEvent;
      // Close dropdown when sidebar is toggled
      if (isOpen) {
        setIsOpen(false);
      }
    };

    // Listen for the sidebar toggle event
    window.addEventListener(SIDEBAR_TOGGLE_EVENT, handleSidebarToggle);

    return () => {
      window.removeEventListener(SIDEBAR_TOGGLE_EVENT, handleSidebarToggle);
    };
  }, [isOpen]);

  if (!user) return null;

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="w-full justify-start gap-2">
          <Avatar className="h-5 w-5">
            <AvatarImage src={`https://avatar.vercel.sh/${user.email}`} />
            <AvatarFallback>
              {user.email?.slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="flex flex-col items-start">
            <span className="text-muted-foreground text-xs">{user.email}</span>
          </div>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56" align="start" side="top">
        <DropdownMenuLabel className="flex items-center gap-2">
          <Avatar className="h-5 w-5">
            <AvatarImage src={`https://avatar.vercel.sh/${user.email}`} />
            <AvatarFallback>
              {user.email?.slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="flex flex-col">
            <span className="text-muted-foreground text-xs">{user.email}</span>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem>
            <Settings className="mr-2 h-4 w-4" />
            <span>Settings</span>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <a
              // href={siteConfig.links.discord.href}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Icons.discord className="mr-2 h-4 w-4" />
              <span>Discord</span>
            </a>
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuLabel className="text-muted-foreground text-xs font-medium">
            Preferences
          </DropdownMenuLabel>
          <div className="flex w-full items-center justify-between gap-2">
            <DropdownMenuLabel>Theme</DropdownMenuLabel>
            <ToggleTheme />
          </div>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive">
          {/* <LogOut className="mr-2 h-4 w-4" /> */}
          <span>Sign out</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function AppSidebar() {
  return (
    <Sidebar variant="inset" className="p-0">
      <SidebarHeader className="border-b pt-12">
        {/* Empty header for spacing */}
      </SidebarHeader>
      <SidebarContent className="divide-y">
        <SidebarGroup className="p-4">
          <SidebarGroupLabel>
            <span>Connections</span>
          </SidebarGroupLabel>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton>
                <BlenderStatusIndicator />
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton>
                <ApiStatusIndicator />
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroup>
        <SidebarGroup className="p-4">
          <SidebarGroupLabel>
            <span>Recents</span>
          </SidebarGroupLabel>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton asChild>
                <Link to="/" className={cn("flex items-center gap-2")}>
                  <span>Runs</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <UserDropdown />
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
