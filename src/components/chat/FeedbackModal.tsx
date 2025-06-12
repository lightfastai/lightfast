"use client"

import React from "react"
import { ThumbsUp, ThumbsDown } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { useMutation } from "convex/react"
import { api } from "../../../convex/_generated/api"
import type { Id } from "../../../convex/_generated/dataModel"

interface FeedbackModalProps {
  isOpen: boolean
  onClose: () => void
  messageId: Id<"messages">
  initialRating: "positive" | "negative"
  existingComment?: string
}

export function FeedbackModal({
  isOpen,
  onClose,
  messageId,
  initialRating,
  existingComment,
}: FeedbackModalProps) {
  const [comment, setComment] = React.useState(existingComment || "")
  const [isSubmitting, setIsSubmitting] = React.useState(false)

  const submitFeedback = useMutation(api.feedback.submitFeedback)

  const handleSubmit = async () => {
    setIsSubmitting(true)
    try {
      await submitFeedback({
        messageId,
        rating: initialRating,
        comment: comment.trim() || undefined,
      })
      onClose()
    } catch (error) {
      console.error("Error submitting feedback:", error)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {initialRating === "positive" ? (
              <>
                <ThumbsUp className="h-4 w-4 text-green-600" />
                Provide additional feedback
              </>
            ) : (
              <>
                <ThumbsDown className="h-4 w-4 text-red-600" />
                What went wrong?
              </>
            )}
          </DialogTitle>
          <DialogDescription>
            {initialRating === "positive"
              ? "Help us understand what made this response helpful."
              : "Your feedback helps us improve our responses."}
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          <Textarea
            placeholder={
              initialRating === "positive"
                ? "What did you like about this response?"
                : "What could have been better?"
            }
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            className="min-h-[100px]"
            autoFocus
          />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting ? "Submitting..." : "Submit feedback"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
