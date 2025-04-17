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

import { earlyAcessFormSchema } from "~/components/early-access/early-acesss-form.validations";

export function EarlyAcessForm() {
  const { toast } = useToast();
  const [isSubmitted, setIsSubmitted] = useState(false);

  // Initialize the form
  const form = useForm({
    schema: earlyAcessFormSchema,
    defaultValues: {
      email: "",
    },
  });

  // Handle form submission
  const onSubmit = async (values: z.infer<typeof earlyAcessFormSchema>) => {
    try {
      // Call the new API endpoint
      const response = await fetch("/api/early-access/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email: values.email }),
      });

      if (!response.ok) {
        const result = (await response.json()) as {
          error: string;
          message: string;
        };
        // Throw an error with the message from the API response if available
        throw new Error(`API Error: ${result.error}`);
      }

      const result = (await response.json()) as {
        success: boolean;
        entry: {
          id: string;
          email_address: string;
          created_at: string;
          updated_at: string;
          status: string;
        };
      };

      console.log(result);

      toast({
        title: "Success!",
        description: "Successfully joined the waitlist!",
      });
      setIsSubmitted(true);
    } catch (error) {
      console.error("Early access form error:", error);
      let errorMsg = "Failed to join the waitlist. Please try again.";
      if (error instanceof Error) {
        // Use the error message thrown from the try block or a default
        errorMsg = error.message || errorMsg;
      }
      toast({
        title: "Error",
        description: errorMsg,
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
                {form.formState.isSubmitting ? "Joining..." : "Join Waitlist"}
              </span>
            </Button>
          </form>
        </Form>
      )}
    </>
  );
}
