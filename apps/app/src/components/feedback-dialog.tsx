"use client";

import { Button } from "@repo/ui/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@repo/ui/components/ui/dialog";
import { Input } from "@repo/ui/components/ui/input";
import { Label } from "@repo/ui/components/ui/label";
import { toast } from "@repo/ui/components/ui/sonner";
import { Textarea } from "@repo/ui/components/ui/textarea";
import { useState } from "react";
import {
  FEEDBACK_MESSAGE_PLACEHOLDER,
  submitSentryFeedback,
} from "~/sentry-feedback";

interface FeedbackDialogProps {
  onOpenChange: (open: boolean) => void;
  open: boolean;
}

export function FeedbackDialog({ onOpenChange, open }: FeedbackDialogProps) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const resetForm = () => {
    setName("");
    setEmail("");
    setMessage("");
    setFormError(null);
  };

  const handleOpenChange = (nextOpen: boolean) => {
    if (isSubmitting) {
      return;
    }

    if (!nextOpen) {
      resetForm();
    }

    onOpenChange(nextOpen);
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const trimmedMessage = message.trim();
    if (!trimmedMessage) {
      setFormError("Add a description before sending feedback.");
      return;
    }

    setFormError(null);
    setIsSubmitting(true);

    try {
      await submitSentryFeedback({
        email: email.trim(),
        message: trimmedMessage,
        name: name.trim(),
      });
      toast.success("Feedback sent", {
        description: "Thanks for helping us improve Lightfast.",
      });
      resetForm();
      onOpenChange(false);
    } catch {
      toast.error("Unable to send feedback", {
        description: "Please try again or contact support.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog onOpenChange={handleOpenChange} open={open}>
      <DialogContent className="gap-5 sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Send feedback</DialogTitle>
          <DialogDescription>
            Tell us what happened and what would have helped.
          </DialogDescription>
        </DialogHeader>
        <form className="grid gap-4" onSubmit={handleSubmit}>
          <div className="grid gap-2">
            <Label htmlFor="feedback-name">Name</Label>
            <Input
              autoComplete="name"
              disabled={isSubmitting}
              id="feedback-name"
              onChange={(event) => setName(event.target.value)}
              placeholder="Your name"
              value={name}
              variant="lf"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="feedback-email">Email</Label>
            <Input
              autoComplete="email"
              disabled={isSubmitting}
              id="feedback-email"
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
              type="email"
              value={email}
              variant="lf"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="feedback-message">Description</Label>
            <Textarea
              aria-describedby={
                formError ? "feedback-message-error" : undefined
              }
              aria-invalid={formError ? true : undefined}
              autoFocus
              disabled={isSubmitting}
              id="feedback-message"
              onChange={(event) => setMessage(event.target.value)}
              placeholder={FEEDBACK_MESSAGE_PLACEHOLDER}
              rows={6}
              value={message}
              variant="lf"
            />
            {formError && (
              <p
                className="text-destructive text-sm"
                id="feedback-message-error"
              >
                {formError}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button
              disabled={isSubmitting}
              onClick={() => handleOpenChange(false)}
              type="button"
              variant="outline"
            >
              Cancel
            </Button>
            <Button disabled={isSubmitting} type="submit">
              {isSubmitting ? "Sending..." : "Send feedback"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
