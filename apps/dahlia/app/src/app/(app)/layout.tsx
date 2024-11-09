import { SidebarInset, SidebarProvider } from "@repo/ui/components/ui/sidebar";

import { AppSidebar } from "~/components/app-sidebar";
import { SiteFooter } from "~/components/site-footer";

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset>
          {children}
          <SiteFooter />
        </SidebarInset>
      </SidebarProvider>
    </>
  );
}
