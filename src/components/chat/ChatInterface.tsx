"use client"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { Textarea } from "@/components/ui/textarea"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { MessageCircle, Plus, Send, Zap } from "lucide-react"
import { useState, useEffect, useRef } from "react"
import { useQuery, useMutation } from "convex/react"
import { api } from "../../../convex/_generated/api"
import type { Doc, Id } from "../../../convex/_generated/dataModel"
import { UserDropdown } from "@/components/auth/UserDropdown"
import { MessageDisplay } from "./MessageDisplay"

type Message = Doc<"messages">
type Thread = Doc<"threads">

interface ChatInterfaceProps {
  currentThread: Thread
  threads: Thread[]
  initialMessages: Message[]
  isNewChat?: boolean
}

// Header component for authenticated chat interface
function ChatHeader() {
  return (
    <header className="border-b bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
            <Zap className="w-5 h-5 text-primary-foreground" />
          </div>
          <span className="font-semibold text-lg">AI Chat</span>
        </div>
        <UserDropdown />
      </div>
    </header>
  )
}

export function ChatInterface({
  currentThread,
  threads: initialThreads,
  initialMessages,
  isNewChat = false,
}: ChatInterfaceProps) {
  const [message, setMessage] = useState("")
  const [currentThreadId, setCurrentThreadId] = useState<Id<"threads">>(
    currentThread._id,
  )
  const [hasCreatedThread, setHasCreatedThread] = useState(false)
  const scrollAreaRef = useRef<HTMLDivElement>(null)

  // Determine if we should skip queries (only skip if we're in new chat mode AND haven't created thread yet)
  const shouldSkipQueries =
    isNewChat && !hasCreatedThread && currentThreadId === "new"

  // Get updated threads from Convex (with real-time updates)
  const threads = useQuery(api.threads.list) ?? initialThreads

  // Get the actual thread data (handles case where we got placeholder data)
  const actualThread = useQuery(
    api.threads.get,
    shouldSkipQueries ? "skip" : { threadId: currentThreadId },
  )

  // Use actual thread if available, otherwise use currentThread
  const displayThread = actualThread ?? currentThread

  // Get messages for current thread (with real-time updates)
  const messages =
    useQuery(
      api.messages.list,
      shouldSkipQueries ? "skip" : { threadId: currentThreadId },
    ) ?? initialMessages

  // Mutations
  const createThread = useMutation(api.threads.create)
  const sendMessage = useMutation(api.messages.send)

  // Handle case where thread doesn't exist or user doesn't have access
  useEffect(() => {
    if (actualThread === null && currentThread.title === "Loading...") {
      // Thread doesn't exist or user doesn't have access, redirect to chat
      window.location.href = "/chat"
    }
  }, [actualThread, currentThread.title])

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (scrollAreaRef.current) {
      scrollAreaRef.current.scrollTop = scrollAreaRef.current.scrollHeight
    }
  }, [messages])

  const handleNewChat = async () => {
    try {
      const newThreadId = await createThread({
        title: "New Chat",
      })
      // Navigate to new thread
      window.location.href = `/chat/${newThreadId}`
    } catch (error) {
      console.error("Error creating new thread:", error)
    }
  }

  const handleSendMessage = async () => {
    if (!message.trim()) return

    try {
      if (isNewChat && currentThreadId === "new") {
        // First message in new chat - create thread first
        const newThreadId = await createThread({
          title:
            message.length > 50 ? `${message.substring(0, 50)}...` : message,
        })

        // Send the message to the new thread
        await sendMessage({
          threadId: newThreadId,
          body: message,
        })

        // Replace the current URL with the new thread URL
        window.history.replaceState({}, "", `/chat/${newThreadId}`)

        // Update the current thread ID and mark that we've created a thread
        setCurrentThreadId(newThreadId)
        setHasCreatedThread(true)
      } else {
        // Normal message sending
        await sendMessage({
          threadId: currentThreadId,
          body: message,
        })
      }

      setMessage("")
    } catch (error) {
      console.error("Error sending message:", error)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  const handleThreadSelect = (threadId: Id<"threads">) => {
    // Navigate to selected thread
    window.location.href = `/chat/${threadId}`
  }

  return (
    <TooltipProvider>
      <div className="flex flex-col h-screen bg-background">
        <ChatHeader />

        <div className="flex flex-1 min-h-0">
          {/* Sidebar */}
          <div className="w-64 border-r bg-muted/40 flex flex-col">
            {/* New Chat Button */}
            <div className="p-4">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full justify-start gap-2"
                    onClick={handleNewChat}
                  >
                    <Plus className="w-4 h-4" />
                    New chat
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Start a new conversation</p>
                </TooltipContent>
              </Tooltip>
            </div>

            <Separator />

            {/* Chat History */}
            <ScrollArea className="flex-1 px-4">
              <div className="space-y-2 py-2">
                {threads?.map((thread) => (
                  <button
                    key={thread._id}
                    type="button"
                    className={`w-full p-2 rounded-md hover:bg-accent cursor-pointer group text-left ${
                      currentThreadId === thread._id ? "bg-accent" : ""
                    }`}
                    onClick={() => handleThreadSelect(thread._id)}
                  >
                    <div className="flex items-center gap-2 text-sm">
                      <MessageCircle className="w-4 h-4 text-muted-foreground" />
                      <span className="truncate">{thread.title}</span>
                      {currentThreadId === thread._id && (
                        <Badge variant="secondary" className="ml-auto text-xs">
                          Active
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {new Date(thread.lastMessageAt).toLocaleDateString()}
                    </p>
                  </button>
                ))}
                {(!threads || threads.length === 0) && (
                  <div className="text-center text-muted-foreground py-4">
                    <p className="text-sm">No conversations yet</p>
                    <p className="text-xs">Start a new chat to begin</p>
                  </div>
                )}
              </div>
            </ScrollArea>
          </div>

          {/* Main Chat Area */}
          <div className="flex-1 flex flex-col min-h-0">
            {/* Chat Header */}
            <div className="border-b p-4 flex-shrink-0">
              <div className="flex items-center justify-between">
                <h1 className="text-lg font-semibold">
                  {displayThread?.title || "AI Chat"}
                </h1>
                <div className="flex items-center gap-2">
                  <Badge variant="outline">Streaming</Badge>
                  <Badge variant="outline">GPT-4o-mini</Badge>
                </div>
              </div>
            </div>

            {/* Messages */}
            <ScrollArea className="flex-1 min-h-0" ref={scrollAreaRef}>
              <div className="p-4">
                <div className="space-y-6 max-w-3xl mx-auto">
                  {!messages?.length && (
                    <div className="text-center text-muted-foreground py-12">
                      <Zap className="w-12 h-12 mx-auto mb-4 opacity-50" />
                      <h3 className="text-lg font-medium mb-2">
                        Welcome to AI Chat
                      </h3>
                      <p>
                        Start a conversation with our AI assistant. Messages
                        stream in real-time!
                      </p>
                    </div>
                  )}

                  {messages
                    ?.slice()
                    .reverse()
                    .map((msg) => (
                      <MessageDisplay
                        key={msg._id}
                        message={msg}
                        userName="User"
                      />
                    ))}
                </div>
              </div>
            </ScrollArea>

            {/* Input Area */}
            <div className="border-t p-4 flex-shrink-0">
              <div className="max-w-3xl mx-auto">
                <div className="flex gap-2">
                  <div className="flex-1 relative">
                    <Textarea
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      onKeyPress={handleKeyPress}
                      placeholder="Message AI assistant..."
                      className="min-h-[60px] resize-none pr-12"
                      rows={1}
                    />
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          onClick={handleSendMessage}
                          disabled={!message.trim()}
                          size="sm"
                          className="absolute right-2 bottom-2 h-8 w-8 p-0"
                        >
                          <Send className="w-4 h-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Send message (Enter)</p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground mt-2 text-center">
                  AI responses are generated using Vercel AI SDK with real-time
                  streaming
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </TooltipProvider>
  )
}
