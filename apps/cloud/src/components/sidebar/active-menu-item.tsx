"use client";

import { SidebarMenuButton } from "@repo/ui/components/ui/sidebar";
import Link from "next/link";
import { usePathname } from "next/navigation";
import * as React from "react";

interface ActiveMenuItemProps {
  href: string;
  children: React.ReactNode;
  size?: "default" | "sm";
}

export function ActiveMenuItem({ href, children, size = "default" }: ActiveMenuItemProps) {
  const pathname = usePathname();
  const isActive = pathname === href;

  return (
    <SidebarMenuButton asChild isActive={isActive} size={size}>
      <Link href={href} prefetch={true}>
        {children}
      </Link>
    </SidebarMenuButton>
  );
}