"use client"

import { useQuery } from "convex/react"
import { api } from "../../../convex/_generated/api"
import type { Id } from "../../../convex/_generated/dataModel"

interface PrefetchThreadProps {
  threadId: Id<"threads">
}

/**
 * Invisible component that prefetches messages for a thread.
 * This leverages Convex's query caching to make navigation instant.
 */
export function PrefetchThread({ threadId }: PrefetchThreadProps) {
  // Prefetch messages for this thread - data gets cached automatically
  useQuery(api.messages.list, { threadId })

  // No UI needed, just prefetching
  return null
}
