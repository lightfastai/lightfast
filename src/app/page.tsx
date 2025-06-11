"use client"

import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { Textarea } from "@/components/ui/textarea"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { MessageCircle, Plus, Send, User, Zap } from "lucide-react"
import { useState, useEffect, useRef } from "react"
import { useQuery, useMutation } from "convex/react"
import { api } from "../../convex/_generated/api"
import type { Doc, Id } from "../../convex/_generated/dataModel"

type Message = Doc<"messages">

export default function Home() {
  const [message, setMessage] = useState("")
  const [author, setAuthor] = useState("User")
  const [currentThreadId, setCurrentThreadId] = useState<Id<"threads"> | null>(
    null,
  )
  const scrollAreaRef = useRef<HTMLDivElement>(null)

  // Get threads for user
  const threads = useQuery(api.threads.list, { userId: author })
  const createThread = useMutation(api.threads.create)

  // Get messages for current thread
  const messages = useQuery(
    api.messages.list,
    currentThreadId ? { threadId: currentThreadId } : "skip",
  )
  const sendMessage = useMutation(api.messages.send)

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (scrollAreaRef.current) {
      scrollAreaRef.current.scrollTop = scrollAreaRef.current.scrollHeight
    }
  }, [messages])

  // Auto-select first thread when threads are loaded
  useEffect(() => {
    if (threads && threads.length > 0 && !currentThreadId) {
      setCurrentThreadId(threads[0]._id)
    }
  }, [threads, currentThreadId])

  // Clear current thread when user changes
  useEffect(() => {
    setCurrentThreadId(null)
  }, [author])

  const handleNewChat = async () => {
    try {
      const newThreadId = await createThread({
        title: "New Chat",
        userId: author,
      })
      setCurrentThreadId(newThreadId)
    } catch (error) {
      console.error("Error creating new thread:", error)
    }
  }

  const handleSendMessage = async () => {
    if (!message.trim()) return

    try {
      // Create a new thread if none is selected
      if (!currentThreadId) {
        const newThreadId = await createThread({
          title: message.substring(0, 50) + (message.length > 50 ? "..." : ""),
          userId: author,
        })
        setCurrentThreadId(newThreadId)

        await sendMessage({
          threadId: newThreadId,
          body: message,
        })
      } else {
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

  return (
    <TooltipProvider>
      <div className="flex h-screen bg-background">
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

          {/* User Name Input */}
          <div className="p-4">
            <label
              htmlFor="author-input"
              className="text-sm font-medium mb-2 block"
            >
              Your Name
            </label>
            <input
              id="author-input"
              type="text"
              value={author}
              onChange={(e) => setAuthor(e.target.value)}
              placeholder="Enter your name"
              className="w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary bg-background"
            />
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
                  onClick={() => setCurrentThreadId(thread._id)}
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

          <Separator />

          {/* User Profile */}
          <div className="p-4">
            <div className="flex items-center gap-2">
              <Avatar className="w-8 h-8">
                <AvatarFallback>
                  <User className="w-4 h-4" />
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{author}</p>
                <p className="text-xs text-muted-foreground">Convex + AI</p>
              </div>
            </div>
          </div>
        </div>

        {/* Main Chat Area */}
        <div className="flex-1 flex flex-col min-h-0">
          {/* Header */}
          <div className="border-b p-4 flex-shrink-0">
            <div className="flex items-center justify-between">
              <h1 className="text-lg font-semibold">
                {currentThreadId && threads
                  ? threads.find((t) => t._id === currentThreadId)?.title ||
                    "AI Chat"
                  : "AI Chat"}
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
                      userName={author}
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
                    disabled={!author.trim()}
                  />
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        onClick={handleSendMessage}
                        disabled={!message.trim() || !author.trim()}
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
                {!author.trim()
                  ? "Please enter your name to start chatting"
                  : "AI responses are generated using Vercel AI SDK with real-time streaming"}
              </p>
            </div>
          </div>
        </div>
      </div>
    </TooltipProvider>
  )
}

// Component to display individual messages with streaming support
function MessageDisplay({
  message,
  userName,
}: { message: Message; userName: string }) {
  const [displayText, setDisplayText] = useState(message.body)
  const [isTyping, setIsTyping] = useState(false)

  // Update display text when message body changes (via Convex reactivity)
  useEffect(() => {
    setDisplayText(message.body)
    setIsTyping(
      Boolean(
        message.isStreaming && !message.isComplete && message.body.length > 0,
      ),
    )
  }, [message.body, message.isStreaming, message.isComplete])

  const isAI = message.messageType === "assistant"
  const isStreaming = message.isStreaming && !message.isComplete

  return (
    <div className={`flex gap-4 ${isAI ? "" : "justify-end"} animate-fade-in`}>
      {isAI && (
        <Avatar className="w-8 h-8 shrink-0">
          <AvatarFallback className="bg-primary text-primary-foreground">
            <Zap className="w-4 h-4" />
          </AvatarFallback>
        </Avatar>
      )}

      <Card
        className={`max-w-2xl ${
          isAI ? "" : "bg-primary text-primary-foreground"
        }`}
      >
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-medium opacity-70">
              {message.messageType === "user" ? userName : "AI Assistant"}
            </p>
            {isStreaming && (
              <div className="flex items-center text-xs opacity-70">
                <div className="flex space-x-1">
                  <div className="w-1 h-1 bg-current rounded-full animate-bounce" />
                  <div
                    className="w-1 h-1 bg-current rounded-full animate-bounce"
                    style={{ animationDelay: "0.1s" }}
                  />
                  <div
                    className="w-1 h-1 bg-current rounded-full animate-bounce"
                    style={{ animationDelay: "0.2s" }}
                  />
                </div>
                <span className="ml-2">typing...</span>
              </div>
            )}
          </div>

          <p className="text-sm leading-relaxed whitespace-pre-wrap">
            {displayText || (isStreaming ? "..." : "")}
            {isTyping && (
              <span className="inline-block w-2 h-4 bg-current animate-pulse ml-1 opacity-70" />
            )}
          </p>

          <div className="flex items-center justify-between mt-2">
            <p className="text-xs opacity-70">
              {new Date(message.timestamp).toLocaleTimeString()}
            </p>
            {message.isComplete && isAI && (
              <Badge variant="secondary" className="text-xs">
                ✓ Complete
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>

      {!isAI && (
        <Avatar className="w-8 h-8 shrink-0">
          <AvatarFallback className="bg-secondary">
            <User className="w-4 h-4" />
          </AvatarFallback>
        </Avatar>
      )}
    </div>
  )
}
