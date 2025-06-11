"use client"

import { ChatInterface } from "./ChatInterface"

import type { Id } from "../../../convex/_generated/dataModel"

export function ChatRouter() {
  // Create a placeholder "no thread" state for immediate chat
  const placeholderThread = {
    _id: "new" as Id<"threads">, // Placeholder ID
    _creationTime: Date.now(),
    title: "New Chat",
    userId: "temp" as Id<"users">,
    createdAt: Date.now(),
    lastMessageAt: Date.now(),
  }

  // Show chat interface immediately - no loading, no redirects
  return (
    <ChatInterface
      currentThread={placeholderThread}
      threads={[]}
      initialMessages={[]}
      isNewChat={true}
    />
  )
}
