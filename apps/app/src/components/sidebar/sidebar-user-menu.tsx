"use client";

import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@repo/ui/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@repo/ui/components/ui/dropdown-menu";
import {
  SidebarMenuButton,
  useSidebar,
} from "@repo/ui/components/ui/sidebar";
import { useClerk, useUser } from "@clerk/nextjs";
import {
  ChevronDown,
  Command,
  LogOut,
  Settings,
  User,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

export function SidebarUserMenu() {
  const { signOut } = useClerk();
  const { user } = useUser();
  const { state } = useSidebar();
  const [open, setOpen] = useState(false);

  // Close dropdown when sidebar state changes
  useEffect(() => {
    if (state === "collapsed") {
      setOpen(false);
    }
  }, [state]);

  const handleSignOut = async () => {
    await signOut(); // Will use afterSignOutUrl from Clerk config
  };

  const displayName = user?.fullName ?? user?.primaryEmailAddress?.emailAddress ?? "User";
  const displayEmail = user?.primaryEmailAddress?.emailAddress ?? "No email";

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <SidebarMenuButton
          size="default"
          className="w-full group-data-[collapsible=icon]:!p-0 !p-0 overflow-visible"
          data-state={open ? "open" : "closed"}
        >
          <div className="h-8 flex items-center w-full overflow-visible">
            <div className="w-8 h-8 flex-shrink-0 overflow-visible">
              <Avatar className="w-8 h-8 !rounded-md">
                {user?.imageUrl && (
                  <AvatarImage
                    src={user.imageUrl}
                    alt={displayName}
                    className="object-cover w-8 h-8 !rounded-md"
                  />
                )}
                <AvatarFallback className="text-xs !rounded-md">
                  <User className="w-4 h-4" />
                </AvatarFallback>
              </Avatar>
            </div>
            <div className="flex items-center gap-2 px-2 flex-1 group-data-[collapsible=icon]:hidden">
              <span className="flex-1 truncate text-left text-xs">
                {displayName}
              </span>
              <ChevronDown className="w-3 h-3" />
            </div>
          </div>
        </SidebarMenuButton>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-56"
        side="right"
        sideOffset={8}
      >
        <DropdownMenuLabel>
          <div className="flex flex-col space-y-1">
            <p className="text-xs font-medium leading-none">{displayName}</p>
            <p className="text-xs leading-none text-muted-foreground opacity-75">
              {displayEmail}
            </p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link
            href="/settings"
            className="cursor-pointer flex items-center justify-between"
            prefetch={true}
          >
            <div className="flex items-center">
              <Settings className="mr-2 h-3 w-3" />
              <span className="text-xs">Settings</span>
            </div>
            <span className="text-xs text-muted-foreground">⌘,</span>
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem className="cursor-pointer">
          <Command className="mr-2 h-3 w-3" />
          <span className="text-xs">Command menu</span>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleSignOut} className="cursor-pointer">
          <LogOut className="mr-2 h-3 w-3" />
          <span className="text-xs">Sign out</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}