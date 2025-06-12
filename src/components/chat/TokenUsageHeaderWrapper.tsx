"use client"

import { usePathname } from "next/navigation"
import { useMemo } from "react"
import type { Id } from "../../../convex/_generated/dataModel"
import { TokenUsageHeader } from "./TokenUsageHeader"

export function TokenUsageHeaderWrapper() {
  const pathname = usePathname()

  // Extract current thread ID from pathname
  const currentThreadId = useMemo(() => {
    if (pathname === "/chat") {
      return "new"
    }
    const match = pathname.match(/^\/chat\/(.+)$/)
    return match ? (match[1] as Id<"threads">) : "new"
  }, [pathname])

  return <TokenUsageHeader threadId={currentThreadId} />
}
