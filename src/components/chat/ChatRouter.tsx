"use client"

import { useQuery, useMutation } from "convex/react"
import { useEffect } from "react"
import { api } from "../../../convex/_generated/api"

export function ChatRouter() {
  const threads = useQuery(api.threads.list)
  const createThread = useMutation(api.threads.create)

  useEffect(() => {
    async function handleRouting() {
      if (threads === undefined) {
        // Still loading
        return
      }

      if (threads && threads.length > 0) {
        // Redirect to most recent thread
        const mostRecentThread = threads.sort(
          (a, b) => b.lastMessageAt - a.lastMessageAt,
        )[0]
        window.location.href = `/chat/${mostRecentThread._id}`
      } else {
        // Create new thread and redirect
        try {
          const newThreadId = await createThread({ title: "New Chat" })
          window.location.href = `/chat/${newThreadId}`
        } catch (error) {
          console.error("Error creating thread:", error)
          window.location.href = "/"
        }
      }
    }

    handleRouting()
  }, [threads, createThread])

  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="text-center">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-muted-foreground">Setting up your chat...</p>
      </div>
    </div>
  )
}
