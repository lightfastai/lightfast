"use client";

import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { Loader2 } from "lucide-react";
import { Button } from "@repo/ui/components/ui/button";
import { Input } from "@repo/ui/components/ui/input";
import { joinWaitlistAction } from "./_actions/waitlist";
import { ConfettiWrapper } from "./confetti-wrapper";
import { captureException } from "@sentry/nextjs";

function SubmitButton({ hasEmail }: { hasEmail: boolean }) {
  const { pending } = useFormStatus();

  return (
    <Button
      type="submit"
      disabled={!hasEmail || pending}
      size="lg"
      className="absolute right-1 top-1/2 -translate-y-1/2 rounded-full"
    >
      {pending ? (
        <>
          <Loader2 className="size-4 animate-spin mr-2" />
          Joining...
        </>
      ) : (
        "Join Waitlist"
      )}
    </Button>
  );
}

export function WaitlistForm() {
  const [state, formAction] = useActionState(joinWaitlistAction, {
    status: "idle",
  });
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

  return (
    <form action={formAction} className="w-full flex flex-col gap-3">
      <div className="relative flex items-center">
        <Input
          type="email"
          name="email"
          placeholder="Enter your email to request early access."
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="pr-56 pl-8 rounded-full h-12"
          aria-describedby="email-error"
          aria-invalid={
            state.status === "validation_error" &&
            Boolean(state.fieldErrors.email)
          }
        />
        <span className="absolute right-36 text-xs text-muted-foreground pointer-events-none">
          Press Enter
        </span>
        <SubmitButton hasEmail={email.length > 0} />
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
