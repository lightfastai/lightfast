"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { SidebarMenuButton } from "@/components/ui/sidebar"
import type { Id } from "../../../convex/_generated/dataModel"

interface ActiveMenuItemProps {
  threadId: Id<"threads"> | "new"
  href: string
  children: React.ReactNode
  className?: string
  size?: "default" | "sm" | "lg"
  prefetch?: boolean
}

// Client component that handles active state for individual menu items
export function ActiveMenuItem({
  threadId,
  href,
  children,
  className = "w-full h-auto p-2.5 text-left",
  size = "default",
  prefetch = true,
}: ActiveMenuItemProps) {
  const pathname = usePathname()

  // Determine if this thread is active
  const isActive =
    threadId === "new" ? pathname === "/chat" : pathname === `/chat/${threadId}`

  return (
    <Link href={href} prefetch={prefetch}>
      <SidebarMenuButton className={className} size={size} isActive={isActive}>
        {children}
      </SidebarMenuButton>
    </Link>
  )
}
