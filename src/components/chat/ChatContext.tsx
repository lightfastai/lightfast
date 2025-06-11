"use client"

import { createContext, useContext } from "react"
import type { Doc, Id } from "../../../convex/_generated/dataModel"

type Message = Doc<"messages">

interface ThreadWithMessages {
  _id: Id<"threads">
  _creationTime: number
  title: string
  userId: Id<"users">
  createdAt: number
  lastMessageAt: number
  isTitleGenerating?: boolean
  recentMessages: Message[]
}

interface ChatContextType {
  threadsWithMessages: ThreadWithMessages[]
}

const ChatContext = createContext<ChatContextType | null>(null)

export function ChatContextProvider({
  children,
  threadsWithMessages,
}: {
  children: React.ReactNode
  threadsWithMessages: ThreadWithMessages[]
}) {
  return (
    <ChatContext.Provider value={{ threadsWithMessages }}>
      {children}
    </ChatContext.Provider>
  )
}

export function useChatContext() {
  const context = useContext(ChatContext)
  if (!context) {
    throw new Error("useChatContext must be used within ChatContextProvider")
  }
  return context
}
