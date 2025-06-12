"use client"

import React from "react"
import { ThumbsUp, ThumbsDown } from "lucide-react"
import { Button } from "@/components/ui/button"
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

  // Get current feedback for this message
  const feedback = useQuery(api.feedback.getUserFeedbackForMessage, {
    messageId,
  })

  // Mutations
  const submitFeedback = useMutation(api.feedback.submitFeedback)
  const removeFeedback = useMutation(api.feedback.removeFeedback)

  // Handle quick feedback (thumbs up/down without modal)
  const handleFeedback = async (rating: "positive" | "negative") => {
    // If we are down-voting, show the modal instead of quick feedback
    if (rating === "negative") {
      setShowFeedbackModal(true)
      return
    }

    if (feedback?.rating === rating) {
      // If clicking the same rating, remove feedback
      await removeFeedback({ messageId })
    } else {
      // Submit or update feedback (for positive ratings)
      await submitFeedback({
        messageId,
        rating: "positive",
        comment: feedback?.comment,
        reasons: feedback?.reasons,
      })
    }
  }

  return (
    <>
      <div className={cn("flex items-center gap-1", className)}>
        <Button
          variant="ghost"
          size="icon"
          className={cn(
            "h-7 w-7 transition-colors",
            feedback?.rating === "positive" &&
              "text-green-600 hover:text-green-700",
          )}
          onClick={() => handleFeedback("positive")}
        >
          <ThumbsUp className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className={cn(
            "h-7 w-7 transition-colors",
            feedback?.rating === "negative" &&
              "text-red-600 hover:text-red-700",
          )}
          onClick={() => handleFeedback("negative")}
        >
          <ThumbsDown className="h-3.5 w-3.5" />
        </Button>
      </div>

      {showFeedbackModal && (
        <FeedbackModal
          isOpen={showFeedbackModal}
          onClose={() => setShowFeedbackModal(false)}
          messageId={messageId}
          existingFeedback={feedback}
        />
      )}
    </>
  )
}
