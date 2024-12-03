import Link from "next/link";

import { Button } from "@repo/ui/components/ui/button";
import { SidebarInset, SidebarProvider } from "@repo/ui/components/ui/sidebar";

import { AppSidebar } from "~/components/app/sidebar";
import { SimpleDotFooter } from "~/components/app/simple-dot-footer";
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
          <header className="relative flex items-center justify-end border p-4">
            {!session && (
              <Button variant="outline" asChild>
                <Link href="/sign-in" prefetch={false}>
                  Sign-in
                </Link>
              </Button>
            )}
          </header>
          <div className="flex flex-col gap-4 p-4">{children}</div>
          <SimpleDotFooter nav={siteNav.footer} />
        </SidebarInset>
      </SidebarProvider>
    </>
  );
}
