"use client"

import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  DEFAULT_PROVIDER,
  type ModelProvider,
  getModelDisplayName,
  getSupportedProviders,
} from "@/lib/ai"
import { Bot, Send } from "lucide-react"
import { useState } from "react"

interface ChatInputProps {
  onSendMessage: (message: string, model: ModelProvider) => Promise<void> | void
  isLoading?: boolean
  placeholder?: string
  disabled?: boolean
  maxLength?: number
  className?: string
}

export function ChatInput({
  onSendMessage,
  isLoading = false,
  placeholder = "Message AI assistant...",
  disabled = false,
  maxLength = 4000,
  className = "",
}: ChatInputProps) {
  const [message, setMessage] = useState("")
  const [isSending, setIsSending] = useState(false)
  const [selectedModel, setSelectedModel] =
    useState<ModelProvider>(DEFAULT_PROVIDER)

  const supportedProviders = getSupportedProviders()

  const handleSendMessage = async () => {
    if (!message.trim() || isSending || disabled) return

    setIsSending(true)
    try {
      await onSendMessage(message, selectedModel)
      setMessage("")
    } catch (error) {
      console.error("Error sending message:", error)
    } finally {
      setIsSending(false)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  const canSend = message.trim() && !isSending && !disabled && !isLoading

  return (
    <div className={`border-t p-4 flex-shrink-0 ${className}`}>
      <div className="max-w-3xl mx-auto">
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <Textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder={placeholder}
              className="min-h-[60px] resize-none pr-12"
              rows={1}
              maxLength={maxLength}
              disabled={disabled || isSending}
            />
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  onClick={handleSendMessage}
                  disabled={!canSend}
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

        <div className="flex items-center justify-between mt-2">
          <div className="flex items-center gap-2">
            <Bot className="w-4 h-4 text-muted-foreground" />
            <Select
              value={selectedModel}
              onValueChange={(value: ModelProvider) => setSelectedModel(value)}
            >
              <SelectTrigger className="h-8 w-40 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {supportedProviders.map((provider) => (
                  <SelectItem
                    key={provider}
                    value={provider}
                    className="text-xs"
                  >
                    {getModelDisplayName(provider)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="text-xs text-muted-foreground">
            {message.length}/{maxLength}
          </div>
        </div>
      </div>
    </div>
  )
}
