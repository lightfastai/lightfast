"use client";

import Link from "next/link";
import { Plus } from "lucide-react";

import { SidebarMenu, SidebarMenuItem } from "@repo/ui/components/ui/sidebar";

export function NewChatButton() {
  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <Link
          href="/"
          className="flex items-center gap-4 transition-colors hover:text-sidebar-accent-foreground"
          aria-label="Return to Dahlia homepage"
        >
          <div className="button flex aspect-square size-8 items-center justify-center rounded-lg text-sidebar-primary-foreground">
            <Plus className="size-4" />
          </div>
          <div className="grid flex-1 text-left text-sm leading-tight">
            <span className="truncate font-semibold">New Chat</span>
          </div>
        </Link>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
