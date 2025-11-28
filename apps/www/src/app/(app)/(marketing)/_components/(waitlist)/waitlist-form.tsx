"use client";

import type { FormEvent } from "react";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@repo/ui/components/ui/button";
import { Input } from "@repo/ui/components/ui/input";
import { ConfettiWrapper } from "./confetti-wrapper";
import { captureException } from "@sentry/nextjs";
import { joinWaitlistAction, type WaitlistState } from "./_actions/waitlist";

export function WaitlistForm() {
  const [state, setState] = useState<WaitlistState>({ status: "idle" });
  const [email, setEmail] = useState("");

  // Track client-side errors
  useEffect(() => {
    if (state.status === "error") {
      // Report to Sentry when an error occurs on the client
      captureException(new Error(`Early access form error: ${state.error}`), {
        tags: {
          component: "waitlist-form",
          error_type: state.isRateLimit ? "rate_limit" : "form_error",
        },
        extra: {
          errorMessage: state.error,
          isRateLimit: state.isRateLimit,
          timestamp: new Date().toISOString(),
        },
        level: state.isRateLimit ? "warning" : "error",
      });
    }
  }, [state]);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!email) return;

    setState({ status: "pending" });

    try {
      const formData = new FormData();
      formData.append("email", email);

      const result = await joinWaitlistAction(null, formData);

      setState(result);

      if (result.status === "success") {
        setEmail(""); // Clear the input on success
      }
    } catch (error) {
      console.error("Waitlist submission error:", error);
      captureException(error, {
        tags: {
          component: "waitlist-form",
          error_type: "action_error",
        },
      });
      setState({
        status: "error",
        error: "An unexpected error occurred. Please try again.",
      });
    }
  };

  if (state.status === "success") {
    return (
      <>
        <ConfettiWrapper />
        <div className="space-y-2">
          <p className="text-sm font-medium">You've joined the early access!</p>
          <p className="text-sm text-muted-foreground">
            We'll send you an invite when we're ready. Check your email for
            updates.
          </p>
        </div>
      </>
    );
  }

  const isPending = state.status === "pending";

  return (
    <form onSubmit={handleSubmit} className="w-full flex flex-col gap-3">
      <div className="relative flex items-center">
        <Input
          type="email"
          name="email"
          placeholder="Enter your email to request early access."
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          disabled={isPending}
          className="pr-56 pl-8 rounded-full h-12 text-foreground"
          aria-describedby="email-error"
          aria-invalid={
            state.status === "validation_error" &&
            Boolean(state.fieldErrors.email)
          }
        />
        <span className="absolute right-36 text-xs text-muted-foreground pointer-events-none">
          Press Enter
        </span>
        <Button
          type="submit"
          disabled={!email || isPending}
          size="lg"
          className="absolute right-1 top-1/2 -translate-y-1/2 rounded-full"
        >
          {isPending ? (
            <>
              <Loader2 className="size-4 animate-spin mr-2" />
              Joining...
            </>
          ) : (
            "Join Waitlist"
          )}
        </Button>
      </div>
      {state.status === "validation_error" && state.fieldErrors.email && (
        <p id="email-error" className="text-xs text-destructive pl-3">
          {state.fieldErrors.email[0]}
        </p>
      )}
      {state.status === "error" && (
        <div className="space-y-1">
          <p
            className={`text-xs ${state.isRateLimit ? "text-yellow-600 dark:text-yellow-500" : "text-destructive"} pl-3`}
          >
            {state.error}
          </p>
          {state.isRateLimit && (
            <p className="text-xs text-muted-foreground pl-3">
              Please wait a moment before trying again.
            </p>
          )}
        </div>
      )}
    </form>
  );
}
