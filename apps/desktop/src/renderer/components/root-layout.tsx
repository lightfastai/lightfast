import { SidebarInset, SidebarProvider } from "@repo/ui/components/ui/sidebar";

import { AppSidebar } from "./app-sidebar";
import { ContentLayout } from "./content-layout";
import TitleBar from "./title-bar";

export function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden">
      <SidebarProvider defaultOpen>
        {/* Title Bar floats on top via absolute positioning */}
        <TitleBar />

        {/* Main content takes full height and width with no offsets */}
        <div className="flex h-full w-full flex-1">
          <AppSidebar />
          <SidebarInset>
            <div className="flex h-full flex-col overflow-hidden">
              <div className="flex-1 overflow-hidden">
                <ContentLayout>{children}</ContentLayout>
              </div>
            </div>
          </SidebarInset>
        </div>
      </SidebarProvider>
    </div>
  );
}
