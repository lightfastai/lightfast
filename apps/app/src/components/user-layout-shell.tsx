"use client";

import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@repo/ui/components/ui/sidebar";
import { usePathname } from "next/navigation";
import type React from "react";
import { Suspense } from "react";
import { AppSidebar } from "~/components/app-sidebar";
import { AuthenticatedTopbar } from "~/components/authenticated-topbar";
import { TeamSwitcher, TeamSwitcherSkeleton } from "~/components/team-switcher";

function TeamSwitcherSlot() {
  return (
    <Suspense fallback={<TeamSwitcherSkeleton />}>
      <TeamSwitcher />
    </Suspense>
  );
}

export function UserLayoutShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const useAccountSettingsSidebar = pathname.startsWith("/account/settings");

  if (!useAccountSettingsSidebar) {
    return (
      <div className="flex flex-1 flex-col overflow-hidden">
        <AuthenticatedTopbar left={<TeamSwitcherSlot />} />
        <div className="relative flex flex-1 flex-col overflow-y-auto bg-background">
          {children}
        </div>
      </div>
    );
  }

  return (
    <SidebarProvider className="!h-full !min-h-0 overflow-hidden bg-background">
      <div className="lg:hidden">
        <AppSidebar />
      </div>
      <SidebarInset className="min-h-0 overflow-hidden">
        <AuthenticatedTopbar
          left={
            <div className="flex min-w-0 items-center">
              <SidebarTrigger className="lg:hidden" />
              <div className="hidden min-w-0 lg:block">
                <TeamSwitcherSlot />
              </div>
            </div>
          }
        />
        <div className="relative flex flex-1 flex-col overflow-y-auto bg-background">
          {children}
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
