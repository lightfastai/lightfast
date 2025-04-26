"use client";

import type * as z from "zod";
import { useState } from "react";
import { useAtom } from "jotai";
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
import { useEarlyAccessAnalytics } from "./hooks/use-early-access-analytics";
import { earlyAccessCountAtom } from "./jotai/early-access-count-atom";

export function EarlyAccessForm() {
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
        // Log success in development
        if (env.NODE_ENV === "development") {
          logger.info("Early access form success:", {
            requestId: data.requestId,
            success: data.success,
          });
        }

        // Track signup with analytics
        trackSignup({
          email: values.email,
          requestId: data.requestId,
        });

        toast({
          title: "Welcome aboard! 🎉",
          description:
            "You've successfully joined the waitlist. We'll notify you when we launch.",
        });

        // Update the waitlist count
        setWaitlistCount((count) => count + 1);

        setIsSubmitted(true);
      },
      (error) => {
        // Report error with context
        reportError(error, {
          component: "EarlyAccessForm",
          errorType: error.type,
          requestId: error.requestId ?? "unknown",
          error: error.error,
          message: error.message,
          metadata: {
            email: values.email,
          },
        });

        // Log error for debugging in development
        if (env.NODE_ENV === "development") {
          logger.error("Early access form error:", {
            type: error.type,
            error: error.error,
            message: error.message,
            requestId: error.requestId,
          });
        }

        // Get user-friendly message based on error type
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
    <>
      {isSubmitted ? (
        <div className="flex flex-col items-center justify-center text-center">
          <Confetti recycle={false} numberOfPieces={400} />
          <p className="text-sm font-semibold">
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
            className="grid w-full grid-cols-1 gap-2 sm:grid-cols-12 sm:gap-2"
          >
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem className="flex flex-col items-start sm:col-span-9">
                  <FormLabel className="sr-only text-xs">Email</FormLabel>
                  <FormControl>
                    <Input
                      className="focus-visible:ring-ring/50 text-xs focus-visible:border-none focus-visible:ring-[1px] md:text-xs"
                      placeholder="you@example.com"
                      autoComplete="email"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage className="text-xs" />
                </FormItem>
              )}
            />
            <Button
              type="submit"
              variant="outline"
              disabled={form.formState.isSubmitting}
              className="w-full rounded-lg px-3 text-xs whitespace-nowrap sm:col-span-3"
            >
              <span className="bg-gradient-to-r from-sky-400 via-fuchsia-400 to-orange-400 bg-clip-text text-transparent">
                {form.formState.isSubmitting ? "Joining..." : "Join Waitlist"}
              </span>
            </Button>
          </form>
        </Form>
      )}
    </>
  );
}
