"use client";

import type * as z from "zod";
import { useState } from "react";
import { useAtom } from "jotai";
import { Send } from "lucide-react";
import Confetti from "react-confetti";

import { Button } from "@repo/ui/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  useForm,
} from "@repo/ui/components/ui/form";
import { Input } from "@repo/ui/components/ui/input";
import { useToast } from "@repo/ui/hooks/use-toast";
import { useLogger } from "@vendor/observability/use-logger";

import { createEarlyAccessEntrySafe } from "~/components/early-access/api/create-early-access-entry";
import { earlyAccessFormSchema } from "~/components/early-access/early-access-form.schema";
import { EarlyAccessFormErrorMap } from "~/components/early-access/errors";
import { env } from "~/env";
import { useErrorReporter } from "~/lib/error-reporting/client-error-reporter";
import { useEarlyAccessAnalytics } from "../early-access/hooks/use-early-access-analytics";
import { earlyAccessCountAtom } from "../early-access/jotai/early-access-count-atom";

const INTRO_TEXTS = [
  "Simplifying the way you interact with applications like Blender, Unity, Fusion360 and more.",
  "Lightfast gives your ideas room to grow... to branch, remix and become what they're meant to be.",
  "We integrate with your tools to make your workflow more efficient.",
  "Ready to get early access?",
];

interface CenterCardEarlyAccessProps {
  isVisible: boolean; // Controlled by scroll progress
}

export function CenterCardEarlyAccess({
  isVisible,
}: CenterCardEarlyAccessProps) {
  const { toast } = useToast();
  const { reportError } = useErrorReporter();
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [_, setWaitlistCount] = useAtom(earlyAccessCountAtom);
  const logger = useLogger();
  const { trackSignup } = useEarlyAccessAnalytics();

  const form = useForm({
    schema: earlyAccessFormSchema,
    defaultValues: {
      email: "",
    },
  });

  const onSubmit = async (values: z.infer<typeof earlyAccessFormSchema>) => {
    const result = await createEarlyAccessEntrySafe({
      email: values.email,
      logger,
    });
    result.match(
      (data) => {
        if (env.NODE_ENV === "development") {
          logger.info("Early access form success:", {
            requestId: data.requestId,
            success: data.success,
          });
        }
        trackSignup({
          email: values.email,
          requestId: data.requestId,
        });
        toast({
          title: "Welcome aboard! 🎉",
          description:
            "You've successfully joined the waitlist. We'll notify you when we launch.",
        });
        setWaitlistCount((count) => count + 1);
        setIsSubmitted(true);
      },
      (error) => {
        reportError(error, {
          component: "CenterCardEarlyAccess",
          errorType: error.type,
          requestId: error.requestId ?? "unknown",
          error: error.error,
          message: error.message,
          metadata: {
            email: values.email,
          },
        });
        if (env.NODE_ENV === "development") {
          logger.error("Early access form error:", {
            type: error.type,
            error: error.error,
            message: error.message,
            requestId: error.requestId,
          });
        }
        const errorMessage =
          EarlyAccessFormErrorMap[error.type] ||
          "Failed to join the waitlist. Please try again.";
        toast({
          title: "Error",
          description: errorMessage,
          variant: "destructive",
        });
      },
    );
  };

  return (
    <div className="center-card-early-access absolute top-8 right-8 left-8">
      {/* Animated intro messages - CSS driven */}
      <div
        className="mb-6 max-w-md space-y-4"
        aria-live="polite"
        aria-atomic="false"
      >
        {INTRO_TEXTS.map((text, index) => (
          <div
            key={`intro-${index}`}
            className="early-access-text text-sm"
            data-index={index}
            role="status"
          >
            {text}
          </div>
        ))}
      </div>

      {/* Form area */}
      <div className="max-w-sm">
        <div className="early-access-form">
          {isSubmitted ? (
            <div
              className="flex flex-col items-center justify-center text-center"
              role="status"
              aria-live="polite"
            >
              <Confetti recycle={false} numberOfPieces={200} />
              <p className="mb-2 text-sm font-semibold">
                {form.getValues("email")} is now on the list! 🎉
              </p>
              <p className="text-muted-foreground text-xs">
                We'll notify you when we launch.
              </p>
            </div>
          ) : (
            <Form {...form}>
              <form
                onSubmit={form.handleSubmit(onSubmit)}
                className="space-y-4"
                aria-label="Early access signup form"
              >
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="sr-only">
                        Email address for early access
                      </FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Input
                            type="email"
                            className="pr-12"
                            placeholder="Enter your email for early access"
                            autoComplete="email"
                            {...field}
                          />
                          <Button
                            type="submit"
                            variant="ghost"
                            size="sm"
                            aria-label="Submit early access signup"
                            disabled={
                              form.formState.isSubmitting ||
                              !field.value?.trim() ||
                              !form.formState.isValid
                            }
                            className="hover:bg-muted absolute top-1/2 right-1 h-8 w-8 -translate-y-1/2 p-0"
                          >
                            {form.formState.isSubmitting ? (
                              <div
                                className="border-muted-foreground h-4 w-4 animate-spin rounded-full border-2 border-t-transparent"
                                aria-label="Submitting..."
                              />
                            ) : (
                              <Send className="h-4 w-4" />
                            )}
                          </Button>
                        </div>
                      </FormControl>
                      <FormMessage className="text-xs" />
                    </FormItem>
                  )}
                />
              </form>
            </Form>
          )}
        </div>
      </div>
    </div>
  );
}
