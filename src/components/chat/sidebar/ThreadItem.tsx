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
      <ActiveMenuItem
        threadId={thread._id}
        href={`/chat/${thread.clientId || thread._id}`}
      >
        <div className="relative flex-1 min-w-0">
          <span
            className={cn(
              "block text-sm font-medium overflow-hidden whitespace-nowrap",
              thread.isTitleGenerating && "animate-pulse blur-[0.5px] opacity-70",
            )}
          >
            {thread.title}
          </span>
          {/* Fade out overlay - covers the action button area */}
          <div 
            className="absolute top-0 right-0 bottom-0 w-8 pointer-events-none"
            style={{
              background: 'linear-gradient(to left, var(--sidebar-background) 0%, var(--sidebar-background) 25%, transparent 100%)'
            }}
          />
        </div>
      </ActiveMenuItem>
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
