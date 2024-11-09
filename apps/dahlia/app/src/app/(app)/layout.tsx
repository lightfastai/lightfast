import { auth } from "@repo/auth";
import { SidebarInset, SidebarProvider } from "@repo/ui/components/ui/sidebar";

import { AppSidebar } from "~/components/app-sidebar";
import { SiteFooter } from "~/components/site-footer";

export default async function Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  return (
    <>
      <SidebarProvider defaultOpen={false}>
        {session && <AppSidebar />}
        <SidebarInset>
          {children}
          <SiteFooter />
        </SidebarInset>
      </SidebarProvider>
    </>
  );
}
