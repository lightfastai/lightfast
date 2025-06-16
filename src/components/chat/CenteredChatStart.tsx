"use client"

import { useAuth } from "@/hooks/useAuth"
import { useTimeGreeting } from "@/hooks/useTimeGreeting"
import { ChatInput } from "./ChatInput"
import type { Id } from "../../../convex/_generated/dataModel"

interface CenteredChatStartProps {
  onSendMessage: (
    message: string,
    modelId: string,
    attachments?: Id<"files">[],
    webSearchEnabled?: boolean,
  ) => Promise<void> | void
  disabled?: boolean
  isLoading?: boolean
}

export function CenteredChatStart({
  onSendMessage,
  disabled = false,
  isLoading = false,
}: CenteredChatStartProps) {
  const { displayName, email } = useAuth()
  const greeting = useTimeGreeting()

  const userName = email || displayName

  return (
    <div className="flex flex-col items-center justify-center h-full min-h-0 px-4">
      <div className="w-full max-w-3xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-semibold text-foreground mb-2">
            {greeting}, {userName}
          </h1>
          <p className="text-muted-foreground">
            What can I help you with today?
          </p>
        </div>
        
        <ChatInput
          onSendMessage={onSendMessage}
          placeholder="Message AI assistant..."
          disabled={disabled}
          isLoading={isLoading}
        />
      </div>
    </div>
  )
}