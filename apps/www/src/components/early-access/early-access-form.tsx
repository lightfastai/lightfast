"use client";

import type * as z from "zod";
import { useState } from "react";
import * as Sentry from "@sentry/nextjs";
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

import type { NextErrorResponse } from "~/components/early-access/errors";
import { earlyAccessFormSchema } from "~/components/early-access/early-access-form.schema";
import { EarlyAccessFormErrorMap } from "~/components/early-access/errors";
import { env } from "~/env";
import {
  addRequestContext,
  createRequestContext,
  REQUEST_ID_HEADER,
} from "~/lib/next-request-id";

export function EarlyAccessForm() {
  const { toast } = useToast();
  const [isSubmitted, setIsSubmitted] = useState(false);

  // Initialize the form
  const form = useForm({
    schema: earlyAccessFormSchema,
    defaultValues: {
      email: "",
    },
  });

  // Handle form submission
  const onSubmit = async (values: z.infer<typeof earlyAccessFormSchema>) => {
    const requestContext = createRequestContext();

    try {
      const headers = new Headers({
        "Content-Type": "application/json",
      });

      // Create and add request context
      addRequestContext(headers, requestContext);

      const response = await fetch("/api/early-access/create", {
        method: "POST",
        headers,
        body: JSON.stringify({ email: values.email }),
      });

      // Get the request ID from response headers (might be different in error cases)
      const responseRequestId = response.headers.get(REQUEST_ID_HEADER);

      if (!response.ok) {
        const errorResponse = (await response.json()) as NextErrorResponse;

        // Set Sentry context and capture error
        Sentry.setContext("early_access_form", {
          email: values.email,
          requestId: responseRequestId,
          originalRequestId: requestContext.requestId,
          errorType: errorResponse.type,
        });

        Sentry.captureException(new Error(errorResponse.message), {
          tags: {
            errorType: errorResponse.type,
            component: "EarlyAccessForm",
          },
        });

        // Log error for debugging in development
        if (env.NODE_ENV === "development") {
          console.error("Early access form error:", {
            requestId: responseRequestId,
            type: errorResponse.type,
            error: errorResponse.error,
            message: errorResponse.message,
            originalRequestId: requestContext.requestId, // For debugging request flow
          });
        }

        // Get user-friendly message based on error type
        const errorMessage =
          EarlyAccessFormErrorMap[errorResponse.type] ||
          "Failed to join the waitlist. Please try again.";

        toast({
          title: "Error",
          description: errorMessage,
          variant: "destructive",
        });
        return;
      }

      const successResult = (await response.json()) as { success: boolean };

      // Log success in development
      if (env.NODE_ENV === "development") {
        console.log("Early access form success:", {
          requestId: responseRequestId,
          ...successResult,
        });
      }

      toast({
        title: "Welcome aboard! 🎉",
        description:
          "You've successfully joined the waitlist. We'll notify you when we launch.",
      });
      setIsSubmitted(true);
    } catch (error) {
      // Set Sentry context and capture unexpected errors
      Sentry.setContext("early_access_form", {
        email: values.email,
        originalRequestId: requestContext.requestId,
      });

      Sentry.captureException(error, {
        tags: {
          errorType: "unexpected_error",
          component: "EarlyAccessForm",
        },
      });

      // Log unexpected errors in development
      if (env.NODE_ENV === "development") {
        console.error("Early access form unexpected error:", {
          error,
          originalRequestId: requestContext.requestId,
        });
      }

      toast({
        title: "Error",
        description: "An unexpected error occurred. Please try again later.",
        variant: "destructive",
      });
    }
  };

  return (
    <>
      {isSubmitted ? (
        <div className="flex flex-col items-center justify-center text-center">
          <Confetti recycle={false} numberOfPieces={400} />
          <p className="text-sm font-semibold">
            {form.getValues("email")} is now on the list! 🎉
          </p>
          <p className="text-xs text-muted-foreground">
            We'll notify you when we launch.
          </p>
        </div>
      ) : (
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="grid w-full grid-cols-12 items-start space-x-2"
          >
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem className="col-span-9">
                  <FormLabel className="sr-only text-xs">Email</FormLabel>
                  <FormControl>
                    <Input
                      className="text-xs focus-visible:border-none focus-visible:ring-[1px] focus-visible:ring-ring/50 md:text-xs"
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
              disabled={form.formState.isSubmitting}
              className="col-span-3 overflow-hidden truncate rounded-lg px-3 text-xs"
            >
              <span className="gradient-text text-xs">
                {form.formState.isSubmitting ? (
                  <>
                    <span className="animate-pulse">Joining</span>
                    <span className="animate-[bounce_1s_infinite]">...</span>
                  </>
                ) : (
                  "Join Waitlist"
                )}
              </span>
            </Button>
          </form>
        </Form>
      )}
    </>
  );
}
