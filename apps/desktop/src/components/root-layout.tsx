import { SidebarInset, SidebarProvider } from "@repo/ui/components/ui/sidebar";

import { AppSidebar } from "./app-sidebar";
import { ContentLayout } from "./content-layout";

export function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen overflow-hidden">
      <SidebarProvider defaultOpen>
        <AppSidebar />
        <SidebarInset>
          <div className="flex h-full flex-col overflow-hidden">
            <div className="flex-1 overflow-hidden">
              <ContentLayout>{children}</ContentLayout>
            </div>
          </div>
        </SidebarInset>
      </SidebarProvider>
    </div>
  );
}
