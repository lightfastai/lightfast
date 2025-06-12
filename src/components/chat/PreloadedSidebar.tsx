"use client"

import { usePreloadedQuery, type Preloaded } from "convex/react"
import type { api } from "../../../convex/_generated/api"
import { ServerSidebarImplementation } from "./ServerSidebarImplementation"
import { SidebarSkeleton } from "./SidebarSkeleton"

interface PreloadedSidebarProps {
  preloadedThreads: Preloaded<typeof api.threads.list>
}

// Client component that consumes preloaded data and provides reactivity
export function PreloadedSidebar({ preloadedThreads }: PreloadedSidebarProps) {
  try {
    // Use preloaded data with reactivity - this provides instant loading with real-time updates
    const threads = usePreloadedQuery(preloadedThreads)

    // Pass the reactive data to the implementation component
    return <ServerSidebarImplementation threads={threads} />
  } catch (error) {
    // If there's an error using preloaded data, show skeleton
    console.warn("Error using preloaded threads data:", error)
    return <SidebarSkeleton />
  }
}
