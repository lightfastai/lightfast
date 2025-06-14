"use client"

import {
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarMenuAction,
} from "@/components/ui/sidebar"
import { cn } from "@/lib/utils"
import { Pin } from "lucide-react"
import { useCallback, useState } from "react"
import type { Id } from "../../../../convex/_generated/dataModel"
import { ActiveMenuItem } from "./ActiveMenuItem"

interface ThreadItemProps {
  thread: {
    _id: Id<"threads">
    clientId?: string
    title: string
    isTitleGenerating?: boolean
    pinned?: boolean
  }
  onPinToggle: (threadId: Id<"threads">) => void
}

export function ThreadItem({ thread, onPinToggle }: ThreadItemProps) {
  const [isPinning, setIsPinning] = useState(false)

  const handlePinClick = useCallback(
    async (e: React.MouseEvent) => {
      e.preventDefault()
      e.stopPropagation()
      setIsPinning(true)
      try {
        await onPinToggle(thread._id)
      } finally {
        setIsPinning(false)
      }
    },
    [onPinToggle, thread._id],
  )

  return (
    <SidebarMenuItem>
      <SidebarMenuButton asChild>
        <ActiveMenuItem
          threadId={thread._id}
          href={`/chat/${thread.clientId || thread._id}`}
        >
          <span
            className={cn(
              "truncate text-sm font-medium",
              thread.isTitleGenerating && "animate-pulse blur-[0.5px] opacity-70",
            )}
          >
            {thread.title}
          </span>
        </ActiveMenuItem>
      </SidebarMenuButton>
      <SidebarMenuAction
        className={cn(
          "transition-opacity",
          thread.pinned
            ? "opacity-100 text-primary"
            : "opacity-0 group-hover/menu-item:opacity-100 hover:text-primary",
        )}
        onClick={handlePinClick}
        disabled={isPinning}
      >
        <Pin
          className={cn(
            "h-4 w-4",
            thread.pinned && "fill-current",
            isPinning && "animate-pulse",
          )}
        />
        <span className="sr-only">
          {thread.pinned ? "Unpin" : "Pin"} thread
        </span>
      </SidebarMenuAction>
    </SidebarMenuItem>
  )
}
