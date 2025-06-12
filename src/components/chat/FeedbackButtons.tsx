"use client"

import React from "react"
import { ThumbsUp, ThumbsDown } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { useMutation, useQuery } from "convex/react"
import { api } from "../../../convex/_generated/api"
import type { Id } from "../../../convex/_generated/dataModel"
import { cn } from "@/lib/utils"
import { FeedbackModal } from "./FeedbackModal"

interface FeedbackButtonsProps {
  messageId: Id<"messages">
  className?: string
}

export function FeedbackButtons({
  messageId,
  className,
}: FeedbackButtonsProps) {
  const [showFeedbackModal, setShowFeedbackModal] = React.useState(false)
  const [modalRating, setModalRating] = React.useState<
    "positive" | "negative" | null
  >(null)

  // Get current feedback for this message
  const feedback = useQuery(api.feedback.getUserFeedbackForMessage, {
    messageId,
  })

  // Mutations
  const submitFeedback = useMutation(api.feedback.submitFeedback)
  const removeFeedback = useMutation(api.feedback.removeFeedback)

  // Handle quick feedback (thumbs up/down without modal)
  const handleQuickFeedback = async (rating: "positive" | "negative") => {
    if (feedback?.rating === rating) {
      // If clicking the same rating, remove feedback
      await removeFeedback({ messageId })
    } else {
      // Submit or update feedback
      await submitFeedback({ messageId, rating })
    }
  }

  // Handle feedback with comment (opens modal)
  const handleFeedbackWithComment = (rating: "positive" | "negative") => {
    setModalRating(rating)
    setShowFeedbackModal(true)
  }

  return (
    <>
      <TooltipProvider>
        <div className={cn("flex items-center gap-1", className)}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className={cn(
                  "h-7 w-7 transition-colors",
                  feedback?.rating === "positive" &&
                    "text-green-600 hover:text-green-700",
                )}
                onClick={() => handleQuickFeedback("positive")}
                onDoubleClick={(e) => {
                  e.preventDefault()
                  handleFeedbackWithComment("positive")
                }}
              >
                <ThumbsUp className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Good response</p>
              <p className="text-xs text-muted-foreground">
                Double-click to add comment
              </p>
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className={cn(
                  "h-7 w-7 transition-colors",
                  feedback?.rating === "negative" &&
                    "text-red-600 hover:text-red-700",
                )}
                onClick={() => handleQuickFeedback("negative")}
                onDoubleClick={(e) => {
                  e.preventDefault()
                  handleFeedbackWithComment("negative")
                }}
              >
                <ThumbsDown className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Bad response</p>
              <p className="text-xs text-muted-foreground">
                Double-click to add comment
              </p>
            </TooltipContent>
          </Tooltip>
        </div>
      </TooltipProvider>

      {showFeedbackModal && modalRating && (
        <FeedbackModal
          isOpen={showFeedbackModal}
          onClose={() => {
            setShowFeedbackModal(false)
            setModalRating(null)
          }}
          messageId={messageId}
          initialRating={modalRating}
          existingComment={feedback?.comment}
        />
      )}
    </>
  )
}
