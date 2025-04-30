import React from "react";

import { SidebarInset } from "@repo/ui/components/ui/sidebar";

interface ContentLayoutProps {
  children: React.ReactNode;
}

export function ContentLayout({ children }: ContentLayoutProps) {
  return (
    <SidebarInset className="bg-background border-border flex h-full w-full flex-col overflow-hidden rounded-lg border">
      {children}
    </SidebarInset>
  );
}
