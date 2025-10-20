"use client";

import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { motion } from "framer-motion";
import { Loader2, Send } from "lucide-react";
import { Button } from "@repo/ui/components/ui/button";
import { Input } from "@repo/ui/components/ui/input";
import { joinWaitlistAction } from "./_actions/waitlist";
import { ConfettiWrapper } from "./confetti-wrapper";
import { captureException } from "@sentry/nextjs";

const paragraphs = [
  {
    id: 0,
    className: "font-semibold text-foreground",
    text: "Built for technical founders and devs",
  },
  {
    id: 1,
    className: "text-foreground",
    text: "Lightfast is a cloud-native agent execution engine designed for developers who want to build production-grade AI applications without infrastructure complexity. Deploy agents in minutes, not days.",
  },
  {
    id: 2,
    className: "text-foreground",
    text: "Building AI agents shouldn't require infrastructure expertise. Focus on your logic while we handle the orchestration.",
  },
  {
    id: 3,
    className: "text-foreground",
    text: "So you don't just deploy faster, you build something you're proud of",
  },
];

function SubmitButton({ hasEmail }: { hasEmail: boolean }) {
  const { pending } = useFormStatus();

  if (!hasEmail && !pending) return null;

  return (
    <Button
      type="submit"
      disabled={!hasEmail || pending}
      variant="ghost"
      size="sm"
      className="absolute right-2 top-1/2 -translate-y-1/2 !bg-transparent"
    >
      {pending ? (
        <Loader2 className="size-4 animate-spin" />
      ) : (
        <Send className="size-4" />
      )}
    </Button>
  );
}

export function WaitlistForm() {
  const [state, formAction] = useActionState(joinWaitlistAction, {
    status: "idle",
  });
  const [email, setEmail] = useState("");

  // Reverse order for animation (bottom to top)
  const animatedParagraphs = [...paragraphs].reverse();

  const containerVariants = {
    hidden: {},
    visible: {
      transition: {
        staggerChildren: 0.4,
      },
    },
  };

  const paragraphVariants = {
    hidden: {
      opacity: 0,
      y: 20,
    },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.6,
        ease: "easeOut",
      },
    },
  };

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
    <div className="space-y-4 max-w-md">
      <motion.div
        className="space-y-4 text-sm"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        {animatedParagraphs.map((para) => (
          <motion.p
            key={para.id}
            className={para.className}
            variants={paragraphVariants}
          >
            {para.text}
          </motion.p>
        ))}
      </motion.div>

      <div className="-mx-3">
        <form action={formAction} className="w-full flex flex-col gap-3">
          <div className="relative">
            <Input
              type="email"
              name="email"
              placeholder="Curious? Continue with your email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="pr-10 rounded-lg"
              aria-describedby="email-error"
              aria-invalid={
                state.status === "validation_error" &&
                Boolean(state.fieldErrors.email)
              }
            />
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
      </div>
    </div>
  );
}
