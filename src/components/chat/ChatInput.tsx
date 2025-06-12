"use client"

import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { DEFAULT_MODEL_ID, getAllModels, getModelById } from "@/lib/ai"
import { Bot, Send } from "lucide-react"
import { useState } from "react"

interface ChatInputProps {
  onSendMessage: (message: string, modelId: string) => Promise<void> | void
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
  const [selectedModelId, setSelectedModelId] = useState(DEFAULT_MODEL_ID)

  const allModels = getAllModels()
  const selectedModel = getModelById(selectedModelId)

  // Group models by provider
  const modelsByProvider = allModels.reduce(
    (acc, model) => {
      if (!acc[model.provider]) {
        acc[model.provider] = []
      }
      acc[model.provider].push(model)
      return acc
    },
    {} as Record<string, typeof allModels>,
  )

  const handleSendMessage = async () => {
    if (!message.trim() || isSending || disabled) return

    setIsSending(true)
    try {
      await onSendMessage(message, selectedModelId)
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
            <Select value={selectedModelId} onValueChange={setSelectedModelId}>
              <SelectTrigger className="h-8 w-[220px] text-xs">
                <SelectValue>{selectedModel?.displayName}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {Object.entries(modelsByProvider).map(([provider, models]) => (
                  <SelectGroup key={provider}>
                    <SelectLabel className="text-xs font-medium capitalize">
                      {provider}
                    </SelectLabel>
                    {models.map((model) => (
                      <SelectItem
                        key={model.id}
                        value={model.id}
                        className="text-xs"
                      >
                        <div className="flex flex-col">
                          <span>{model.displayName}</span>
                          {model.features.thinking && (
                            <span className="text-[10px] text-muted-foreground">
                              Extended reasoning mode
                            </span>
                          )}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectGroup>
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
