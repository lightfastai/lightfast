"use client"

import { useQuery } from "convex/react"
import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { api } from "../../../convex/_generated/api"
import type { Doc, Id } from "../../../convex/_generated/dataModel"

type Thread = Doc<"threads">

interface PrefetchManagerProps {
  threads: Thread[]
  currentThreadId?: string
  maxPrefetchCount?: number
}

/**
 * Enhanced prefetch manager that:
 * 1. Prefetches thread messages for recent threads
 * 2. Prefetches route segments for instant navigation
 * 3. Manages prefetch priority based on user behavior
 */
export function PrefetchManager({
  threads,
  currentThreadId,
  maxPrefetchCount = 20,
}: PrefetchManagerProps) {
  const router = useRouter()

  // Sort threads by last activity and limit to maxPrefetchCount
  const threadsToPrefetch = threads
    .sort((a, b) => b.lastMessageAt - a.lastMessageAt)
    .slice(0, maxPrefetchCount)

  // Prefetch routes for instant navigation
  useEffect(() => {
    // Prefetch chat routes for all recent threads
    for (const thread of threadsToPrefetch) {
      router.prefetch(`/chat/${thread._id}`)
    }

    // Always prefetch the new chat route
    router.prefetch("/chat")
  }, [threadsToPrefetch, router])

  // Find threads adjacent to current thread for priority prefetching
  useEffect(() => {
    if (!currentThreadId) return

    const currentIndex = threads.findIndex((t) => t._id === currentThreadId)
    if (currentIndex === -1) return

    const adjacentIds: Id<"threads">[] = []

    // Get 2 threads before and after current
    for (
      let i = Math.max(0, currentIndex - 2);
      i <= Math.min(threads.length - 1, currentIndex + 2);
      i++
    ) {
      if (i !== currentIndex) {
        adjacentIds.push(threads[i]._id as Id<"threads">)
      }
    }

    // Prefetch adjacent thread routes
    for (const id of adjacentIds) {
      router.prefetch(`/chat/${id}`)
    }
  }, [currentThreadId, threads, router])

  // Render PrefetchThread components for message data
  return (
    <>
      {threadsToPrefetch.map((thread) => (
        <MessagePrefetch key={`prefetch-${thread._id}`} thread={thread} />
      ))}
    </>
  )
}

// Component that prefetches messages for a single thread
function MessagePrefetch({ thread }: { thread: Thread }) {
  // Prefetch messages - Convex will cache the results
  useQuery(api.messages.list, { threadId: thread._id as Id<"threads"> })

  // Also prefetch thread details
  useQuery(api.threads.get, { threadId: thread._id as Id<"threads"> })

  return null
}
