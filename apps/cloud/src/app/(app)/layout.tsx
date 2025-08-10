import { SidebarProvider } from "@repo/ui/components/ui/sidebar";
import { TooltipProvider } from "@repo/ui/components/ui/tooltip";
import { Suspense } from "react";
import { ServerSidebarImplementation } from "~/components/sidebar/server-sidebar-implementation";
import { SidebarSkeleton } from "~/components/sidebar/sidebar-skeleton";

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <TooltipProvider>
      <SidebarProvider defaultOpen={false}>
        <div className="flex h-screen w-full bg-background">
          <Suspense fallback={<SidebarSkeleton />}>
            <ServerSidebarImplementation />
          </Suspense>
          <div className="flex border-l border-muted/30 flex-col w-full">
            {/* Content area */}
            <div className="flex-1 min-h-0 overflow-hidden">{children}</div>
          </div>
        </div>
      </SidebarProvider>
    </TooltipProvider>
  );
}