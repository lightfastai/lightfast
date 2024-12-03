import { SidebarInset, SidebarProvider } from "@repo/ui/components/ui/sidebar";

import { AppSidebar } from "~/components/app/sidebar";
import { SimpleDotFooter } from "~/components/app/simple-dot-footer";
import { LoginButton } from "~/components/auth/login-button";
import { siteNav } from "~/config/site";
import { api } from "~/trpc/server";

export default async function Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await api.app.auth.getSession();
  return (
    <>
      <SidebarProvider defaultOpen={false}>
        {session && <AppSidebar />}
        <SidebarInset>
          {!session && (
            <header className="relative flex items-center justify-end p-4">
              <LoginButton />
            </header>
          )}
          <div className="flex flex-col gap-4 p-4">{children}</div>
          <SimpleDotFooter nav={siteNav.footer} />
        </SidebarInset>
      </SidebarProvider>
    </>
  );
}
