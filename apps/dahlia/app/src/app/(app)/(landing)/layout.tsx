import { SidebarInset, SidebarProvider } from "@repo/ui/components/ui/sidebar";

import { AppSidebar } from "~/components/app/sidebar";
import { auth } from "../../../../../../../vendor/auth/src";

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
          {/* <SimpleDotFooter nav={siteNav.footer} /> */}
        </SidebarInset>
      </SidebarProvider>
    </>
  );
}
