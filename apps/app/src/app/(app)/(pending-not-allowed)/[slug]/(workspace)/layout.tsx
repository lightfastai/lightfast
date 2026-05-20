import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@repo/ui/components/ui/sidebar";
import { Loader2 } from "lucide-react";
import { Suspense } from "react";
import { AppSidebar } from "~/components/app-sidebar";
import { AuthenticatedTopbar } from "~/components/authenticated-topbar";
import { TeamSwitcher, TeamSwitcherSkeleton } from "~/components/team-switcher";

export default function WorkspaceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SidebarProvider className="!h-full !min-h-0 overflow-hidden bg-background">
      <AppSidebar />
      <SidebarInset className="min-h-0 overflow-hidden">
        <AuthenticatedTopbar
          left={
            <div className="flex min-w-0 items-center gap-2">
              <SidebarTrigger className="lg:hidden" />
              <div className="min-w-0 lg:hidden">
                <Suspense fallback={<TeamSwitcherSkeleton />}>
                  <TeamSwitcher />
                </Suspense>
              </div>
            </div>
          }
        />
        <div className="min-h-0 flex-1 overflow-y-auto">
          <Suspense fallback={<PageLoadingSkeleton />}>{children}</Suspense>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}

function PageLoadingSkeleton() {
  return (
    <div className="flex h-full min-h-0 w-full items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
    </div>
  );
}
