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
import { Send } from "lucide-react"
import { useState } from "react"
import { ScrollArea } from "@/components/ui/scroll-area"

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
  const [selectedModelId, setSelectedModelId] =
    useState<string>(DEFAULT_MODEL_ID)

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
    <div className={`p-4 flex-shrink-0 ${className}`}>
      <div className="max-w-3xl mx-auto">
        <div className="flex gap-2">
          <div className="flex-1 relative min-w-0">
            <div className="relative w-full h-[200px] rounded-md border">
              <ScrollArea className="w-full h-full" type="always">
                <div className="w-full pr-12 pb-16">
                  <Textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    onKeyPress={handleKeyPress}
                    placeholder={placeholder}
                    className="w-full min-h-[184px] resize-none border-0 focus-visible:ring-0 whitespace-pre-wrap break-all overflow-hidden"
                    maxLength={maxLength}
                    disabled={disabled || isSending}
                    style={{
                      overflowWrap: "break-word",
                      width: "100%",
                    }}
                  />
                </div>
              </ScrollArea>
            </div>

            {/* Model Selector positioned inside textarea at bottom left */}
            <div className="absolute left-2 bottom-2">
              <Select
                value={selectedModelId}
                onValueChange={setSelectedModelId}
              >
                <SelectTrigger className="h-6 w-[140px] text-xs border-0 bg-background/80 backdrop-blur-sm">
                  <SelectValue>{selectedModel?.displayName}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(modelsByProvider).map(
                    ([provider, models]) => (
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
                    ),
                  )}
                </SelectContent>
              </Select>
            </div>

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

        {/* Bottom section for future features */}
        <div className="flex items-center justify-between mt-2">
          <div className="flex items-center gap-2">
            {/* Placeholder for future features like Deep Research */}
          </div>
          <div className="text-xs text-muted-foreground">
            {message.length}/{maxLength}
          </div>
        </div>
      </div>
    </div>
  )
}
