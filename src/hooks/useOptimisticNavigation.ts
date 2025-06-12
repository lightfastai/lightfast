"use client"

import { useRouter, usePathname } from "next/navigation"
import { useTransition, useCallback, useEffect } from "react"
import { useQuery } from "convex/react"
import { api } from "../../convex/_generated/api"
import type { Id, Doc } from "../../convex/_generated/dataModel"

export function useOptimisticNavigation() {
  const router = useRouter()
  const pathname = usePathname()
  const [isPending, startTransition] = useTransition()

  // Prefetch thread data when hovering over links
  const prefetchThread = useCallback(
    (threadId: Id<"threads">) => {
      // This will trigger Convex to cache the data
      router.prefetch(`/chat/${threadId}`)
    },
    [router],
  )

  // Navigate with optimistic updates
  const navigateToThread = useCallback(
    (threadId: Id<"threads">) => {
      startTransition(() => {
        // Use router.push for instant client-side navigation
        router.push(`/chat/${threadId}`)
      })
    },
    [router],
  )

  // Navigate to new chat
  const navigateToNewChat = useCallback(() => {
    startTransition(() => {
      router.push("/chat")
    })
  }, [router])

  // Prefetch adjacent threads for keyboard navigation
  const threads = useQuery(api.threads.list) ?? []
  const currentThreadId = pathname.split("/chat/")[1] as
    | Id<"threads">
    | undefined

  useEffect(() => {
    if (!currentThreadId || threads.length === 0) return

    const currentIndex = threads.findIndex(
      (t: Doc<"threads">) => t._id === currentThreadId,
    )
    if (currentIndex === -1) return

    // Prefetch previous and next threads
    if (currentIndex > 0) {
      router.prefetch(`/chat/${threads[currentIndex - 1]._id}`)
    }
    if (currentIndex < threads.length - 1) {
      router.prefetch(`/chat/${threads[currentIndex + 1]._id}`)
    }
  }, [currentThreadId, threads, router])

  return {
    navigateToThread,
    navigateToNewChat,
    prefetchThread,
    isPending,
    currentThreadId,
  }
}
