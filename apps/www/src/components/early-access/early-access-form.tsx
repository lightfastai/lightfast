"use client";

import type * as z from "zod";
import { useState } from "react";
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

import { createEarlyAccessSafe } from "~/components/early-access/early-access-form-api";
import { earlyAccessFormSchema } from "~/components/early-access/early-access-form.schema";
import { EarlyAccessFormErrorMap } from "~/components/early-access/errors";
import { env } from "~/env";
import { useErrorReporter } from "~/hooks/use-error-reporter";
import { createRequestContext } from "~/lib/next-request-id";

export function EarlyAccessForm() {
  const { toast } = useToast();
  const { reportError } = useErrorReporter();
  const [isSubmitted, setIsSubmitted] = useState(false);

  const form = useForm({
    schema: earlyAccessFormSchema,
    defaultValues: {
      email: "",
    },
  });

  const onSubmit = async (values: z.infer<typeof earlyAccessFormSchema>) => {
    const requestContext = createRequestContext();

    const result = await createEarlyAccessSafe({
      email: values.email,
      requestId: requestContext.requestId,
    });

    result.match(
      (data) => {
        // Log success in development
        if (env.NODE_ENV === "development") {
          console.log("Early access form success:", {
            requestId: data.requestId,
            success: data.success,
          });
        }

        toast({
          title: "Welcome aboard! 🎉",
          description:
            "You've successfully joined the waitlist. We'll notify you when we launch.",
        });
        setIsSubmitted(true);
      },
      (error) => {
        // Report error with context
        reportError(error, {
          component: "EarlyAccessForm",
          errorType: error.type,
          requestId: error.requestId ?? requestContext.requestId,
          error: error.error,
          message: error.message,
          metadata: {
            email: values.email,
            originalRequestId: requestContext.requestId,
          },
        });

        // Log error for debugging in development
        if (env.NODE_ENV === "development") {
          console.error("Early access form error:", {
            type: error.type,
            error: error.error,
            message: error.message,
            requestId: error.requestId,
            originalRequestId: requestContext.requestId,
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
