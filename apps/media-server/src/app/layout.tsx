import "@repo/ui/globals.css";

import { SidebarInset, SidebarProvider } from "@repo/ui/components/ui/sidebar";
import { Toaster } from "@repo/ui/components/ui/toaster";
import { fonts } from "@repo/ui/lib/fonts";
import { cn } from "@repo/ui/lib/utils";

import { AppSidebar } from "~/components/sidebar";
import { SiteHeader } from "~/components/site-header";
import { ResourcesProvider } from "~/providers/resources-provider";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head />
      <body className={cn("dark bg-background", fonts)}>
        <ResourcesProvider>
          <div className="flex h-screen">
            <SidebarProvider defaultOpen>
              <AppSidebar />
              <SidebarInset>
                <div className="flex h-full flex-col">
                  <SiteHeader />
                  <div className="flex-1">{children}</div>
                </div>
              </SidebarInset>
            </SidebarProvider>
          </div>
          <Toaster />
        </ResourcesProvider>
      </body>
    </html>
  );
}
