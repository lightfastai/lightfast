"use client"

import { useQuery } from "convex/react"
import { api } from "../../../convex/_generated/api"
import { ServerSidebarImplementation } from "./ServerSidebarImplementation"
import { SidebarSkeleton } from "./SidebarSkeleton"

// Client-side fallback for the sidebar when server-side fetching fails
export function ClientSidebar() {
  const threads = useQuery(api.threads.list)

  // Show skeleton while loading
  if (threads === undefined) {
    return <SidebarSkeleton />
  }

  return <ServerSidebarImplementation threads={threads} />
}
